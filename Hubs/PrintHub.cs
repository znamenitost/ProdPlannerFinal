using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using ProductionPlanner.Services.LabelPrint;

namespace ProductionPlanner.Hubs;

/// <summary>Hub для print-agent (WinForms). Auth: access_token в query.</summary>
[AllowAnonymous]
public class PrintHub : Hub
{
    public const string AgentsGroup = "print-agents";
    public const string JobAvailableMethod = "PrintJobAvailable";

    private readonly IOptions<PrintAgentOptions> _options;
    private readonly ILogger<PrintHub> _logger;

    public PrintHub(IOptions<PrintAgentOptions> options, ILogger<PrintHub> logger)
    {
        _options = options;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        if (http == null || !PrintAgentAuth.IsAuthorized(http.Request, _options))
        {
            _logger.LogWarning("PrintHub: отказ в подключении {ConnectionId}", Context.ConnectionId);
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, AgentsGroup);
        _logger.LogInformation("PrintHub: агент подключён {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AgentsGroup);
        if (exception != null)
            _logger.LogWarning(exception, "PrintHub: агент отключён {ConnectionId}", Context.ConnectionId);
        else
            _logger.LogInformation("PrintHub: агент отключён {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
