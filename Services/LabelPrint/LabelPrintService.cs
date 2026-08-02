using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Services.LabelPrint;

public sealed class LabelPrintService : ILabelPrintService
{
    private readonly ApplicationDbContext _db;
    private readonly ICustomerOrderTrackingService _customerOrders;
    private readonly IHubContext<PrintHub> _printHub;
    private readonly IHubContext<NotificationHub> _notificationHub;
    private readonly IOptions<PrintAgentOptions> _options;
    private readonly ILogger<LabelPrintService> _logger;

    public LabelPrintService(
        ApplicationDbContext db,
        ICustomerOrderTrackingService customerOrders,
        IHubContext<PrintHub> printHub,
        IHubContext<NotificationHub> notificationHub,
        IOptions<PrintAgentOptions> options,
        ILogger<LabelPrintService> logger)
    {
        _db = db;
        _customerOrders = customerOrders;
        _printHub = printHub;
        _notificationHub = notificationHub;
        _options = options;
        _logger = logger;
    }

    public async Task TryEnqueueForCompletedTaskAsync(int taskId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Value.AccessToken))
        {
            _logger.LogDebug("PrintAgent:AccessToken пуст — печать этикеток отключена");
            return;
        }

        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null || task.Status != JobStatus.Completed)
            return;

        // Этикетка на весь заказ: дочерние этапы не печатаем.
        if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            return;

        var alreadyQueued = await _db.PrintJobs
            .AsNoTracking()
            .AnyAsync(j =>
                j.TaskId == task.Id
                && j.Status != PrintJobStatus.Failed, cancellationToken);
        if (alreadyQueued)
            return;

        try
        {
            await EnqueueCoreAsync(task, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogDebug(ex, "Пропуск автопечати для задачи {TaskId}", taskId);
        }
    }

    public async Task<PrintJobDto> EnqueueManualAsync(int taskId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Value.AccessToken))
            throw new InvalidOperationException("Печать этикеток не настроена на сервере");

        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new InvalidOperationException("Задача не найдена");

        return await EnqueueCoreAsync(task, cancellationToken);
    }

    private async Task<PrintJobDto> EnqueueCoreAsync(ProductionTask task, CancellationToken cancellationToken)
    {
        var customerName = CustomerOrderKey.TryGetDisplayName(task.FolderPath);
        if (string.IsNullOrWhiteSpace(customerName))
            throw new InvalidOperationException(
                "Не удалось определить заказчика: укажите путь к папке клиента");

        var pickupCode = await EnsurePickupCodeAsync(task, customerName, cancellationToken);
        if (string.IsNullOrWhiteSpace(pickupCode))
            throw new InvalidOperationException("Не удалось выдать код получения");

        var fileLabel = StripFileName(task.FileName);

        var job = new PrintJob
        {
            TaskId = task.Id,
            OrderTitle = customerName.Trim(),
            PrimaryComment = Truncate(fileLabel, 500) ?? "",
            PickupCode = pickupCode,
            Status = PrintJobStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        _db.PrintJobs.Add(job);
        await _db.SaveChangesAsync(cancellationToken);

        var dto = await ToDtoAsync(job, cancellationToken);
        await _printHub.Clients.Group(PrintHub.AgentsGroup).SendAsync(
            PrintHub.JobAvailableMethod,
            dto,
            cancellationToken);

        _logger.LogInformation(
            "Этикетка поставлена в очередь: job {JobId}, task {TaskId}, code {Code}",
            job.Id, job.TaskId, job.PickupCode);

        return dto;
    }

    public async Task<IReadOnlyList<PrintJobDto>> GetPendingJobsAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await _db.PrintJobs
            .AsNoTracking()
            .Where(j => j.Status == PrintJobStatus.Pending)
            .OrderBy(j => j.Id)
            .Take(50)
            .ToListAsync(cancellationToken);

        var result = new List<PrintJobDto>(jobs.Count);
        foreach (var job in jobs)
            result.Add(await ToDtoAsync(job, cancellationToken));
        return result;
    }

    public async Task<PrintJobDto?> ClaimJobAsync(
        int jobId,
        string? agentName,
        CancellationToken cancellationToken = default)
    {
        var job = await _db.PrintJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job == null || job.Status != PrintJobStatus.Pending)
            return null;

        job.Status = PrintJobStatus.Claimed;
        job.AgentName = Truncate(agentName, 100);
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return await ToDtoAsync(job, cancellationToken);
    }

    public Task<bool> MarkPrintingAsync(int jobId, string? agentName, CancellationToken cancellationToken = default) =>
        UpdateStatusAsync(jobId, PrintJobStatus.Printing, agentName, null, notify: true, cancellationToken);

    public Task<bool> MarkPrintedAsync(int jobId, string? agentName, CancellationToken cancellationToken = default) =>
        UpdateStatusAsync(jobId, PrintJobStatus.Printed, agentName, null, notify: true, cancellationToken);

    public Task<bool> MarkFailedAsync(
        int jobId,
        string? agentName,
        string? errorMessage,
        CancellationToken cancellationToken = default) =>
        UpdateStatusAsync(jobId, PrintJobStatus.Failed, agentName, errorMessage, notify: true, cancellationToken);

    private async Task<bool> UpdateStatusAsync(
        int jobId,
        PrintJobStatus status,
        string? agentName,
        string? errorMessage,
        bool notify,
        CancellationToken cancellationToken)
    {
        var job = await _db.PrintJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job == null)
            return false;

        job.Status = status;
        job.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(agentName))
            job.AgentName = Truncate(agentName, 100);
        if (status == PrintJobStatus.Failed)
            job.ErrorMessage = Truncate(errorMessage, 500);
        else if (status == PrintJobStatus.Printed)
            job.ErrorMessage = null;

        await _db.SaveChangesAsync(cancellationToken);

        if (notify)
        {
            await _notificationHub.Clients.All.SendAsync(
                "LabelPrintStatus",
                new LabelPrintStatusDto
                {
                    JobId = job.Id,
                    TaskId = job.TaskId,
                    Status = status.ToString(),
                    OrderTitle = job.OrderTitle,
                    PrimaryComment = job.PrimaryComment,
                    PickupCode = job.PickupCode,
                    ErrorMessage = job.ErrorMessage
                },
                cancellationToken);
        }

        return true;
    }

    private async Task<string?> EnsurePickupCodeAsync(
        ProductionTask task,
        string customerDisplayName,
        CancellationToken cancellationToken)
    {
        var letter = CustomerOrderKey.ResolvePickupLetter(task.FolderPath, customerDisplayName);
        if (!string.IsNullOrWhiteSpace(task.PickupCode)
            && PickupCodes.StartsWithLetter(task.PickupCode, letter))
        {
            return task.PickupCode.Trim();
        }

        var used = await _db.ProductionTasks
            .AsNoTracking()
            .Where(t => !t.HiddenFromTaskTable && t.PickupCode != null && t.PickupCode != "")
            .Select(t => t.PickupCode!)
            .ToListAsync(cancellationToken);

        var usedSet = new HashSet<string>(used, StringComparer.OrdinalIgnoreCase);
        // Буква устаревшего кода не совпала с указателем пути — код возвращаем в пул.
        if (!string.IsNullOrWhiteSpace(task.PickupCode))
            usedSet.Remove(PickupCodes.Normalize(task.PickupCode));
        var code = PickupCodes.Allocate(letter, usedSet);
        task.PickupCode = code;
        await _db.SaveChangesAsync(cancellationToken);
        return code;
    }

    private async Task<PrintJobDto> ToDtoAsync(PrintJob job, CancellationToken cancellationToken)
    {
        var orderPath = "";
        try
        {
            var link = await _customerOrders.CreateOrGetLinkAsync(job.TaskId, "", cancellationToken);
            var code = (job.PickupCode ?? "").Trim();
            if (!string.IsNullOrEmpty(link.Path) && !string.IsNullOrEmpty(code))
                orderPath = $"{link.Path}?c={Uri.EscapeDataString(code)}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Не удалось построить OrderPath для print job {JobId}", job.Id);
        }

        return new PrintJobDto
        {
            Id = job.Id,
            TaskId = job.TaskId,
            OrderTitle = job.OrderTitle,
            PrimaryComment = job.PrimaryComment,
            PickupCode = job.PickupCode,
            OrderPath = orderPath,
            Status = job.Status.ToString(),
            CreatedAt = job.CreatedAt
        };
    }

    private static string StripFileName(string? fileName)
    {
        var name = (fileName ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            return "";
        return Path.GetFileNameWithoutExtension(name);
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value))
            return value;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
