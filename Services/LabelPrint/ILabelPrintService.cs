using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services.LabelPrint;

public interface ILabelPrintService
{
    /// <summary>Ручная печать из меню / после «Готово» (quantity копий в одном задании).</summary>
    Task<PrintJobDto> EnqueueManualAsync(
        int taskId,
        int quantity = 1,
        CancellationToken cancellationToken = default);

    /// <summary>Пакетная печать произвольных наклеек 58×30 (по заданию на каждую строку).</summary>
    Task<PrintCustomLabelsResponseDto> EnqueueTextLabelsAsync(
        IReadOnlyList<CustomLabelRowDto> rows,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PrintJobDto>> GetPendingJobsAsync(CancellationToken cancellationToken = default);

    Task<PrintJobDto?> ClaimJobAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkPrintingAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkPrintedAsync(int jobId, string? agentName, CancellationToken cancellationToken = default);

    Task<bool> MarkFailedAsync(
        int jobId,
        string? agentName,
        string? errorMessage,
        CancellationToken cancellationToken = default);
}
