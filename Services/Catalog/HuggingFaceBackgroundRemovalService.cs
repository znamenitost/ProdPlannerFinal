using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ProductionPlanner.Services.Catalog;

/// <summary>
/// Calls Hugging Face Gradio Space (BRIA RMBG) to remove image backgrounds.
/// Upload file → queue call → read SSE → download PNG.
/// </summary>
public sealed class HuggingFaceBackgroundRemovalService : IBackgroundRemovalService
{
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
        var safeName = string.IsNullOrWhiteSpace(fileName) ? "logo.png" : Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(Path.GetExtension(safeName)))
            safeName += mime switch
            {
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                _ => ".png"
            };

        // Bound total wait so reverse-proxies (1gb) don't return an opaque 502 first.
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(50));
        var ct = timeoutCts.Token;

        // One retry on transport errors: DPI/firewalls on shared hosting sometimes
        // reset the first connection but let a fresh one through.
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            try
            {
                var uploadedPath = await UploadAsync(baseUrl, imageBytes, mime, safeName, ct);
                if (string.IsNullOrWhiteSpace(uploadedPath))
                    return new BackgroundRemovalResult(false, null, "Не удалось загрузить изображение в модель");

                var eventId = await SubmitAsync(baseUrl, apiName, uploadedPath, mime, safeName, ct);
                if (string.IsNullOrWhiteSpace(eventId))
                    return new BackgroundRemovalResult(false, null, "Не удалось запустить обработку (проверьте HuggingFace:Token)");

                var pngUrl = await WaitForPngUrlAsync(baseUrl, apiName, eventId, ct);
                if (string.IsNullOrWhiteSpace(pngUrl))
                    return new BackgroundRemovalResult(false, null, "Модель не вернула результат");

                var pngBytes = await DownloadAsync(pngUrl, ct);
                if (pngBytes is null || pngBytes.Length == 0)
                    return new BackgroundRemovalResult(false, null, "Не удалось скачать результат");

                return new BackgroundRemovalResult(true, pngBytes, null);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("Hugging Face background removal timed out");
                return new BackgroundRemovalResult(false, null, "Таймаут удаления фона. Попробуйте ещё раз через минуту.");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (HttpRequestException ex)
            {
                if (attempt < 2 && !ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Hugging Face HTTP failed (attempt {Attempt}), retrying once", attempt);
                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(1.5), ct);
                    }
                    catch (OperationCanceledException)
                    {
                        // Budget exhausted or caller cancelled; next send surfaces the right exception.
                    }
                    continue;
                }
                _logger.LogWarning(ex, "Hugging Face HTTP failed");
                return new BackgroundRemovalResult(false, null, "Сервер не достучался до Hugging Face (исходящий HTTPS)");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Hugging Face background removal failed");
                return new BackgroundRemovalResult(false, null, "Сервис удаления фона временно недоступен");
            }
        }

        return new BackgroundRemovalResult(false, null, "Сервис удаления фона временно недоступен");
    }

    public async Task<BackgroundRemovalDiagnostics> DiagnoseAsync(CancellationToken cancellationToken = default)
    {
        var baseUrl = (_options.SpaceBaseUrl ?? "").TrimEnd('/');
        var proxyEnabled = !string.IsNullOrWhiteSpace(_options.Proxy);
        if (string.IsNullOrWhiteSpace(baseUrl))
            return new BackgroundRemovalDiagnostics("", proxyEnabled, false, null, 0, "Config", "Space не настроен");

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(20));
        var ct = timeoutCts.Token;

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/gradio_api/info");
            ApplyAuth(request);
            using var response = await _http.SendAsync(request, ct);
            sw.Stop();
            return new BackgroundRemovalDiagnostics(
                baseUrl, proxyEnabled, response.IsSuccessStatusCode, (int)response.StatusCode,
                sw.ElapsedMilliseconds, null, null);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            sw.Stop();
            return new BackgroundRemovalDiagnostics(
                baseUrl, proxyEnabled, false, null, sw.ElapsedMilliseconds,
                "Timeout", "Исходящее соединение зависло и сорвано по таймауту (20 с)");
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            return new BackgroundRemovalDiagnostics(
                baseUrl, proxyEnabled, false, null, sw.ElapsedMilliseconds,
                ex.InnerException?.GetType().Name ?? ex.GetType().Name, ex.Message);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new BackgroundRemovalDiagnostics(
                baseUrl, proxyEnabled, false, null, sw.ElapsedMilliseconds,
                ex.GetType().Name, ex.Message);
        }
    }

    private async Task<string?> UploadAsync(
        string baseUrl,
        byte[] imageBytes,
        string mime,
        string fileName,
        CancellationToken cancellationToken)
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(imageBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(fileContent, "files", fileName);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/gradio_api/upload")
        {
            Content = form
        };
        ApplyAuth(request);

        using var response = await _http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("HF upload failed: HTTP {Status} {Body}", (int)response.StatusCode, Truncate(body));
            return null;
        }

        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
            return doc.RootElement[0].GetString();
        return null;
    }

    private async Task<string?> SubmitAsync(
        string baseUrl,
        string apiName,
        string uploadedPath,
        string mime,
        string fileName,
        CancellationToken cancellationToken)
    {
        // Gradio FileData: path from /upload (preferred over huge data URLs).
        var payload = new Dictionary<string, object?>
        {
            ["data"] = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["path"] = uploadedPath,
                    ["url"] = $"{baseUrl}/gradio_api/file={uploadedPath}",
                    ["orig_name"] = fileName,
                    ["mime_type"] = mime,
                    ["meta"] = new Dictionary<string, string> { ["_type"] = "gradio.FileData" }
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/gradio_api/call/{apiName}");
        ApplyAuth(request);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await _http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("HF submit failed: HTTP {Status} {Body}", (int)response.StatusCode, Truncate(body));
            return null;
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("event_id", out var idEl) ? idEl.GetString() : null;
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
        request.Headers.Accept.ParseAdd("text/event-stream");

        using var response = await _http.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("HF poll failed: HTTP {Status} {Body}", (int)response.StatusCode, Truncate(err));
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
                    _logger.LogWarning("HF error event: {Data}", Truncate(dataJson));
                    return null;
                }

                eventName = null;
                dataBuilder.Clear();
            }
        }

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

        if (root.GetArrayLength() >= 2)
        {
            var url = TryGetUrl(root[1]);
            if (!string.IsNullOrWhiteSpace(url))
                return url;
        }

        foreach (var el in root.EnumerateArray())
        {
            var url = TryGetUrl(el);
            if (!string.IsNullOrWhiteSpace(url) && url.Contains(".png", StringComparison.OrdinalIgnoreCase))
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
        return el.TryGetProperty("url", out var urlEl) ? urlEl.GetString() : null;
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
