using ProductionPlanner.Models;

namespace ProductionPlanner.Services.CustomerOrders;

public static class CustomerOrderPublicStatus
{
    public const string Queued = "В очереди";
    public const string InProgress = "В работе";
    public const string Ready = "Готов к выдаче";

    public const string KindQueued = "queued";
    public const string KindInProgress = "inProgress";
    public const string KindReady = "ready";

    public static (string Label, string Kind) Map(JobStatus status) => status switch
    {
        JobStatus.Completed => (Ready, KindReady),
        JobStatus.InProgress or JobStatus.Paused => (InProgress, KindInProgress),
        _ => (Queued, KindQueued)
    };
}
