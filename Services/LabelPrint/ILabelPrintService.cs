using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.LabelPrint;

public interface ILabelPrintService
{
    /// <summary>Ставит этикетку в очередь, если задача — финально готовый заказ (не этап split).</summary>
    Task TryEnqueueForCompletedTaskAsync(int taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PrintJobDto>> GetPendingJobsAsync(CancellationToken cancellationToken = default);

    Task<PrintJobDto?> ClaimJobAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkPrintingAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkPrintedAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkFailedAsync(int jobId, string? agentName, string? errorMessage, CancellationToken cancellationToken = default);
}
