using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace ProductionPlanner.PrintAgent;

internal sealed class PrintJobDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string OrderTitle { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public string Status { get; set; } = "";
}

internal sealed class PrintAgentClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly AgentConfig _config;
    private readonly HttpClient _http = new();
    private HubConnection? _hub;
    private readonly SemaphoreSlim _printLock = new(1, 1);
    private CancellationToken _runToken;

    public event Action<string>? StatusChanged;
    public event Action<PrintJobDto>? JobPrinting;

    public PrintAgentClient(AgentConfig config)
    {
        _config = config;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _runToken = cancellationToken;
        EnsureHeaders();

        var healthUrl = $"{_config.ServerUrl.TrimEnd('/')}/api/print-agent/health";
        using (var health = await _http.GetAsync(healthUrl, cancellationToken))
        {
            if (!health.IsSuccessStatusCode)
                throw new InvalidOperationException("Сервер отклонил токен (health). Проверьте AccessToken.");
        }

        var hubUrl = $"{_config.ServerUrl.TrimEnd('/')}/printHub?access_token={Uri.EscapeDataString(_config.AccessToken)}";
        _hub = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
            })
            .WithAutomaticReconnect()
            .Build();

        _hub.On<PrintJobDto>("PrintJobAvailable", job =>
        {
            _ = Task.Run(() => HandleJobAsync(job));
        });

        _hub.Reconnected += async _ =>
        {
            StatusChanged?.Invoke("Переподключено, проверка очереди");
            await DrainPendingAsync(_runToken);
        };

        await _hub.StartAsync(cancellationToken);
        StatusChanged?.Invoke("SignalR подключён");
        await DrainPendingAsync(cancellationToken);
    }

    public async Task StopAsync()
    {
        if (_hub != null)
        {
            try { await _hub.StopAsync(); } catch { /* ignore */ }
            await _hub.DisposeAsync();
            _hub = null;
        }
    }

    private void EnsureHeaders()
    {
        _http.DefaultRequestHeaders.Remove("X-Print-Agent-Token");
        _http.DefaultRequestHeaders.Add("X-Print-Agent-Token", _config.AccessToken);
    }

    private async Task DrainPendingAsync(CancellationToken cancellationToken)
    {
        EnsureHeaders();
        var url = $"{_config.ServerUrl.TrimEnd('/')}/api/print-agent/jobs/pending";
        using var response = await _http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return;

        var json = await response.Content.ReadAsStringAsync();
        var jobs = JsonSerializer.Deserialize<List<PrintJobDto>>(json, JsonOptions) ?? new List<PrintJobDto>();
        foreach (var job in jobs)
            await HandleJobAsync(job);
    }

    private async Task HandleJobAsync(PrintJobDto job)
    {
        if (!await _printLock.WaitAsync(0))
            return;

        try
        {
            if (_runToken.IsCancellationRequested)
                return;

            EnsureHeaders();
            var claimed = await PostAsync($"jobs/{job.Id}/claim", cancellationToken: _runToken);
            if (!claimed)
            {
                StatusChanged?.Invoke($"Задание {job.Id} уже взято");
                return;
            }

            await PostAsync($"jobs/{job.Id}/printing", _runToken);
            JobPrinting?.Invoke(job);

            try
            {
                LabelPrinter.Print(_config.PrinterName, job.OrderTitle, job.PickupCode);
                await PostAsync($"jobs/{job.Id}/printed", _runToken);
                StatusChanged?.Invoke($"Напечатано: {job.PickupCode}");
            }
            catch (Exception ex)
            {
                await PostFailedAsync(job.Id, ex.Message, _runToken);
                StatusChanged?.Invoke("Ошибка печати: " + ex.Message);
            }
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke("Ошибка задания: " + ex.Message);
        }
        finally
        {
            _printLock.Release();
        }
    }

    private async Task<bool> PostAsync(string relative, CancellationToken cancellationToken)
    {
        var url = $"{_config.ServerUrl.TrimEnd('/')}/api/print-agent/{relative}";
        var body = JsonSerializer.Serialize(new { agentName = _config.AgentName });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var response = await _http.PostAsync(url, content, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    private async Task PostFailedAsync(int jobId, string error, CancellationToken cancellationToken)
    {
        var url = $"{_config.ServerUrl.TrimEnd('/')}/api/print-agent/jobs/{jobId}/failed";
        var body = JsonSerializer.Serialize(new { agentName = _config.AgentName, errorMessage = error });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        await _http.PostAsync(url, content, cancellationToken);
    }

    public void Dispose()
    {
        _http.Dispose();
        _printLock.Dispose();
    }
}
