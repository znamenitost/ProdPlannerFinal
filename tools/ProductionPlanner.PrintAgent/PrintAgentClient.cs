using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Win32;

namespace ProductionPlanner.PrintAgent;

internal sealed class PrintJobDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    /// <summary>OrderLabel (75×120) | TextLabel (58×30, строки Line1–Line3).</summary>
    public string JobType { get; set; } = "";
    public string OrderTitle { get; set; } = "";
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public string Line1 { get; set; } = "";
    public string Line2 { get; set; } = "";
    public string Line3 { get; set; } = "";
    public string OrderPath { get; set; } = "";
    public int Copies { get; set; } = 1;
    public string Status { get; set; } = "";

    public bool IsTextLabel => string.Equals(JobType, "TextLabel", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// Дефолтный WithAutomaticReconnect() сдаётся через ~42 с (0/2/10/30),
/// после чего Closed без рестарта — агент «засыпает» до ручного Отключить/Подключить.
/// </summary>
internal sealed class PersistentRetryPolicy : IRetryPolicy
{
    private static readonly TimeSpan[] Delays =
    {
        TimeSpan.Zero,
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(10),
        TimeSpan.FromSeconds(30)
    };

    public TimeSpan? NextRetryDelay(RetryContext retryContext)
    {
        var idx = Math.Min(retryContext.PreviousRetryCount, Delays.Length - 1);
        return Delays[idx];
    }
}

internal sealed class PrintAgentClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly TimeSpan[] StartRetryDelays =
    {
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(15),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromSeconds(60)
    };

    private const int WatchdogIntervalMs = 45_000;

    private readonly AgentConfig _config;
    private readonly HttpClient _http = new();
    private readonly SemaphoreSlim _printLock = new(1, 1);
    private readonly SemaphoreSlim _connectLock = new(1, 1);
    private readonly object _retryGate = new();

    private HubConnection? _hub;
    private CancellationToken _runToken;
    private volatile bool _wantConnected;
    private volatile bool _disposingHub;
    private int _startRetryAttempt;
    private CancellationTokenSource? _closedRetryCts;
    private System.Threading.Timer? _watchdogTimer;
    private bool _powerHooked;

    public event Action<string>? StatusChanged;
    public event Action<PrintJobDto>? JobPrinting;

    public PrintAgentClient(AgentConfig config)
    {
        _config = config;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _wantConnected = true;
        _runToken = cancellationToken;
        _startRetryAttempt = 0;
        EnsurePowerHook();
        await ConnectCoreAsync(cancellationToken);
        StartWatchdog();
    }

    public async Task StopAsync()
    {
        _wantConnected = false;
        CancelClosedRetry();
        StopWatchdog();

        await _connectLock.WaitAsync();
        try
        {
            await DisposeHubAsync();
        }
        finally
        {
            _connectLock.Release();
        }
    }

    private async Task ConnectCoreAsync(CancellationToken cancellationToken)
    {
        await _connectLock.WaitAsync(cancellationToken);
        try
        {
            if (!_wantConnected || cancellationToken.IsCancellationRequested)
                return;

            EnsureHeaders();

            var healthUrl = $"{_config.ServerUrl.TrimEnd('/')}/api/print-agent/health";
            using (var health = await _http.GetAsync(healthUrl, cancellationToken))
            {
                if (!health.IsSuccessStatusCode)
                    throw new InvalidOperationException("Сервер отклонил токен (health). Проверьте AccessToken.");
            }

            if (_hub != null)
            {
                if (_hub.State == HubConnectionState.Connected)
                {
                    StatusChanged?.Invoke("SignalR подключён");
                    await DrainPendingAsync(cancellationToken);
                    return;
                }

                await DisposeHubAsync();
            }

            var hubUrl = $"{_config.ServerUrl.TrimEnd('/')}/printHub?access_token={Uri.EscapeDataString(_config.AccessToken)}";
            _hub = new HubConnectionBuilder()
                .WithUrl(hubUrl, options =>
                {
                    options.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
                })
                .WithAutomaticReconnect(new PersistentRetryPolicy())
                .Build();

            // Чуть мягче серверных 30s — после сна ПК не рвать сразу.
            _hub.ServerTimeout = TimeSpan.FromSeconds(60);
            _hub.KeepAliveInterval = TimeSpan.FromSeconds(15);

            _hub.On<PrintJobDto>("PrintJobAvailable", job =>
            {
                _ = Task.Run(() => HandleJobAsync(job));
            });

            _hub.Reconnecting += error =>
            {
                StatusChanged?.Invoke(
                    error != null
                        ? "Переподключение… (" + error.Message + ")"
                        : "Переподключение…");
                return Task.CompletedTask;
            };

            _hub.Reconnected += async _ =>
            {
                _startRetryAttempt = 0;
                StatusChanged?.Invoke("Переподключено, проверка очереди");
                await DrainPendingAsync(_runToken);
                StatusChanged?.Invoke("Подключено, ожидание заданий");
            };

            _hub.Closed += error =>
            {
                // Dispose/Stop тоже шлёт Closed — не крутить retry поверх своего же Stop.
                if (!_wantConnected || _disposingHub)
                    return Task.CompletedTask;

                StatusChanged?.Invoke(
                    error != null
                        ? "Соединение закрыто: " + error.Message
                        : "Соединение закрыто");
                ScheduleClosedRetry();
                return Task.CompletedTask;
            };

            await _hub.StartAsync(cancellationToken);
            _startRetryAttempt = 0;
            StatusChanged?.Invoke("SignalR подключён");
            await DrainPendingAsync(cancellationToken);
            StatusChanged?.Invoke("Подключено, ожидание заданий");
        }
        finally
        {
            _connectLock.Release();
        }
    }

    private void ScheduleClosedRetry()
    {
        if (!_wantConnected)
            return;

        CancelClosedRetry();
        var cts = new CancellationTokenSource();
        lock (_retryGate)
            _closedRetryCts = cts;

        var attempt = _startRetryAttempt;
        var delay = StartRetryDelays[Math.Min(attempt, StartRetryDelays.Length - 1)];
        _startRetryAttempt = attempt + 1;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delay, cts.Token);
                if (!_wantConnected || cts.IsCancellationRequested)
                    return;

                StatusChanged?.Invoke($"Повторное подключение (попытка {_startRetryAttempt})…");
                await ConnectCoreAsync(_runToken);
            }
            catch (OperationCanceledException)
            {
                // stop or superseded
            }
            catch (Exception ex)
            {
                StatusChanged?.Invoke("Ошибка переподключения: " + ex.Message);
                if (_wantConnected)
                    ScheduleClosedRetry();
            }
        });
    }

    private void CancelClosedRetry()
    {
        CancellationTokenSource? cts;
        lock (_retryGate)
        {
            cts = _closedRetryCts;
            _closedRetryCts = null;
        }

        if (cts == null)
            return;

        try { cts.Cancel(); } catch { /* ignore */ }
        cts.Dispose();
    }

    private void StartWatchdog()
    {
        StopWatchdog();
        _watchdogTimer = new System.Threading.Timer(
            _ => _ = WatchdogTickAsync(),
            null,
            WatchdogIntervalMs,
            WatchdogIntervalMs);
    }

    private void StopWatchdog()
    {
        var timer = _watchdogTimer;
        _watchdogTimer = null;
        timer?.Dispose();
    }

    private async Task WatchdogTickAsync()
    {
        if (!_wantConnected || _runToken.IsCancellationRequested)
            return;

        var hub = _hub;
        if (hub == null)
        {
            ScheduleClosedRetry();
            return;
        }

        if (hub.State == HubConnectionState.Disconnected)
        {
            ScheduleClosedRetry();
            return;
        }

        if (hub.State != HubConnectionState.Connected)
            return;

        try
        {
            await DrainPendingAsync(_runToken);
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke("Ошибка проверки очереди: " + ex.Message);
        }
    }

    private void EnsurePowerHook()
    {
        if (_powerHooked)
            return;

        try
        {
            SystemEvents.PowerModeChanged += OnPowerModeChanged;
            _powerHooked = true;
        }
        catch
        {
            // Session 0 / неинтерактивный контекст — игнор
        }
    }

    private void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
    {
        if (e.Mode != PowerModes.Resume || !_wantConnected)
            return;

        // После сна TCP часто мёртв, а SignalR ещё думает Connected до ServerTimeout.
        StatusChanged?.Invoke("Выход из сна — переподключение…");
        _startRetryAttempt = 0;
        _ = Task.Run(async () =>
        {
            try
            {
                await _connectLock.WaitAsync();
                try
                {
                    if (!_wantConnected)
                        return;
                    await DisposeHubAsync();
                }
                finally
                {
                    _connectLock.Release();
                }

                await ConnectCoreAsync(_runToken);
            }
            catch (Exception ex)
            {
                StatusChanged?.Invoke("Ошибка после сна: " + ex.Message);
                if (_wantConnected)
                    ScheduleClosedRetry();
            }
        });
    }

    private async Task DisposeHubAsync()
    {
        if (_hub == null)
            return;

        var hub = _hub;
        _hub = null;
        _disposingHub = true;
        try
        {
            try { await hub.StopAsync(); } catch { /* ignore */ }
            try { await hub.DisposeAsync(); } catch { /* ignore */ }
        }
        finally
        {
            _disposingHub = false;
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
                var copies = job.Copies > 0 ? job.Copies : 1;
                if (copies > 200) copies = 200;

                if (job.IsTextLabel)
                {
                    LabelPrinter.PrintTextLabel(
                        _config.PrinterName,
                        job.Line1,
                        job.Line2,
                        job.Line3,
                        copies);
                }
                else
                {
                    if (copies > 50) copies = 50;
                    LabelPrinter.Print(
                        _config.PrinterName,
                        job.OrderTitle,
                        job.PickupCode,
                        copies);
                }

                await PostAsync($"jobs/{job.Id}/printed", _runToken);
                var jobLabel = job.IsTextLabel
                    ? (job.Line1.Length > 0 ? job.Line1 : "58×30")
                    : job.PickupCode;
                StatusChanged?.Invoke(
                    copies > 1
                        ? $"Напечатано: {jobLabel} ×{copies}"
                        : $"Напечатано: {jobLabel}");
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
        _wantConnected = false;
        CancelClosedRetry();
        StopWatchdog();

        if (_powerHooked)
        {
            try { SystemEvents.PowerModeChanged -= OnPowerModeChanged; } catch { /* ignore */ }
            _powerHooked = false;
        }

        _http.Dispose();
        _printLock.Dispose();
        _connectLock.Dispose();
    }
}
