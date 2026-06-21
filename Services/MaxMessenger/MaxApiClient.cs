using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ProductionPlanner.Services.MaxMessenger;

public interface IMaxApiClient
{
    Task SendMessageToUserAsync(long maxUserId, string text, CancellationToken cancellationToken = default);
}

public sealed class MaxApiClient : IMaxApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _http;
    private readonly MaxBotOptions _options;
    private readonly ILogger<MaxApiClient> _logger;

    public MaxApiClient(HttpClient http, IOptions<MaxBotOptions> options, ILogger<MaxApiClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendMessageToUserAsync(long maxUserId, string text, CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured || maxUserId <= 0 || string.IsNullOrWhiteSpace(text))
            return;

        var payload = new
        {
            text = text.Trim(),
            format = "markdown",
            notify = true
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"messages?user_id={maxUserId}");
        request.Headers.Authorization = new AuthenticationHeaderValue(_options.AccessToken.Trim());
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await _http.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
            return;

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        _logger.LogWarning(
            "MAX API messages failed for user {MaxUserId}: HTTP {Status} {Body}",
            maxUserId,
            (int)response.StatusCode,
            body.Length > 500 ? body[..500] : body);
    }
}
