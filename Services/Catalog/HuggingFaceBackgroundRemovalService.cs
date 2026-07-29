using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ProductionPlanner.Services.Catalog;

/// <summary>
/// Calls a public Hugging Face Gradio Space (BRIA RMBG) to remove image backgrounds.
/// Flow: POST /gradio_api/call/{api} → poll SSE → download PNG.
/// </summary>
public sealed class HuggingFaceBackgroundRemovalService : IBackgroundRemovalService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _http;
    private readonly HuggingFaceOptions _options;
    private readonly ILogger<HuggingFaceBackgroundRemovalService> _logger;

    public HuggingFaceBackgroundRemovalService(
        HttpClient http,
        IOptions<HuggingFaceOptions> options,
        ILogger<HuggingFaceBackgroundRemovalService> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length == 0)
            return new BackgroundRemovalResult(false, null, "Пустое изображение");

        if (imageBytes.Length > _options.MaxUploadBytes)
            return new BackgroundRemovalResult(false, null, "Файл слишком большой (макс. 5 МБ)");

        var mime = NormalizeMime(contentType);
        if (mime is null)
            return new BackgroundRemovalResult(false, null, "Поддерживаются PNG, JPEG и WebP");

        var baseUrl = (_options.SpaceBaseUrl ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            return new BackgroundRemovalResult(false, null, "Space не настроен");

        var apiName = string.IsNullOrWhiteSpace(_options.ApiName) ? "image" : _options.ApiName.Trim().Trim('/');
        var dataUrl = $"data:{mime};base64,{Convert.ToBase64String(imageBytes)}";
        var safeName = string.IsNullOrWhiteSpace(fileName) ? "logo.png" : Path.GetFileName(fileName);

        try
        {
            var eventId = await SubmitAsync(baseUrl, apiName, dataUrl, mime, safeName, cancellationToken);
            if (string.IsNullOrWhiteSpace(eventId))
                return new BackgroundRemovalResult(false, null, "Не удалось запустить обработку");

            var pngUrl = await WaitForPngUrlAsync(baseUrl, apiName, eventId, cancellationToken);
            if (string.IsNullOrWhiteSpace(pngUrl))
                return new BackgroundRemovalResult(false, null, "Модель не вернула результат");

            var pngBytes = await DownloadAsync(pngUrl, cancellationToken);
            if (pngBytes is null || pngBytes.Length == 0)
                return new BackgroundRemovalResult(false, null, "Не удалось скачать результат");

            return new BackgroundRemovalResult(true, pngBytes, null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hugging Face background removal failed");
            return new BackgroundRemovalResult(false, null, "Сервис удаления фона временно недоступен");
        }
    }

    private async Task<string?> SubmitAsync(
        string baseUrl,
        string apiName,
        string dataUrl,
        string mime,
        string fileName,
        CancellationToken cancellationToken)
    {
        var payload = new
        {
            data = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["path"] = null,
                    ["url"] = dataUrl,
                    ["orig_name"] = fileName,
                    ["mime_type"] = mime,
                    ["meta"] = new Dictionary<string, string> { ["_type"] = "gradio.FileData" }
                }
            }
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{baseUrl}/gradio_api/call/{apiName}");
        ApplyAuth(request);
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        using var response = await _http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "HF Space submit failed: HTTP {Status} {Body}",
                (int)response.StatusCode,
                Truncate(body));
            return null;
        }

        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.TryGetProperty("event_id", out var idEl))
            return idEl.GetString();
        return null;
    }

    private async Task<string?> WaitForPngUrlAsync(
        string baseUrl,
        string apiName,
        string eventId,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{baseUrl}/gradio_api/call/{apiName}/{eventId}");
        ApplyAuth(request);

        using var response = await _http.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning(
                "HF Space poll failed: HTTP {Status} {Body}",
                (int)response.StatusCode,
                Truncate(err));
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);
        string? eventName = null;
        var dataBuilder = new StringBuilder();

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
                break;

            if (line.StartsWith("event:", StringComparison.Ordinal))
            {
                eventName = line["event:".Length..].Trim();
                dataBuilder.Clear();
                continue;
            }

            if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                var chunk = line["data:".Length..].TrimStart();
                if (dataBuilder.Length > 0)
                    dataBuilder.Append('\n');
                dataBuilder.Append(chunk);
                continue;
            }

            if (line.Length == 0 && eventName is not null && dataBuilder.Length > 0)
            {
                var dataJson = dataBuilder.ToString();
                if (string.Equals(eventName, "complete", StringComparison.OrdinalIgnoreCase))
                    return ExtractPngUrl(dataJson);
                if (string.Equals(eventName, "error", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("HF Space error event: {Data}", Truncate(dataJson));
                    return null;
                }

                eventName = null;
                dataBuilder.Clear();
            }
        }

        // Some servers omit the trailing blank line after the last event.
        if (string.Equals(eventName, "complete", StringComparison.OrdinalIgnoreCase) && dataBuilder.Length > 0)
            return ExtractPngUrl(dataBuilder.ToString());

        return null;
    }

    private static string? ExtractPngUrl(string dataJson)
    {
        using var doc = JsonDocument.Parse(dataJson);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() == 0)
            return null;

        // Returns: [sliderImages, pngFile] — prefer the dedicated PNG file (index 1).
        if (root.GetArrayLength() >= 2)
        {
            var fileEl = root[1];
            var url = TryGetUrl(fileEl);
            if (!string.IsNullOrWhiteSpace(url))
                return url;
        }

        // Fallback: walk any FileData-like objects.
        foreach (var el in root.EnumerateArray())
        {
            var url = TryGetUrl(el);
            if (!string.IsNullOrWhiteSpace(url) &&
                url.Contains(".png", StringComparison.OrdinalIgnoreCase))
                return url;
        }

        foreach (var el in root.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Array)
                continue;
            foreach (var inner in el.EnumerateArray())
            {
                var url = TryGetUrl(inner);
                if (!string.IsNullOrWhiteSpace(url))
                    return url;
            }
        }

        return null;
    }

    private static string? TryGetUrl(JsonElement el)
    {
        if (el.ValueKind != JsonValueKind.Object)
            return null;
        if (el.TryGetProperty("url", out var urlEl))
            return urlEl.GetString();
        return null;
    }

    private async Task<byte[]?> DownloadAsync(string url, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        ApplyAuth(request);
        using var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadAsByteArrayAsync(cancellationToken);
    }

    private void ApplyAuth(HttpRequestMessage request)
    {
        if (!_options.IsConfigured)
            return;
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.Token.Trim());
    }

    private static string? NormalizeMime(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return "image/png";
        var mime = contentType.Split(';')[0].Trim().ToLowerInvariant();
        return mime switch
        {
            "image/png" => "image/png",
            "image/jpeg" or "image/jpg" => "image/jpeg",
            "image/webp" => "image/webp",
            _ => null
        };
    }

    private static string Truncate(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return "";
        return text.Length <= 400 ? text : text[..400];
    }
}
