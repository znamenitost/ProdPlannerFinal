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
    public const int MinCopies = 1;
    public const int MaxCopies = 50;
    /// <summary>Для произвольных наклеек тиражи больше (например 60 шт с одной строки).</summary>
    public const int MaxTextLabelCopies = 200;
    public const int MaxTextLabelRowsPerBatch = 100;

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

    public async Task<PrintJobDto> EnqueueManualAsync(
        int taskId,
        int quantity = 1,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Value.AccessToken))
            throw new InvalidOperationException("Печать этикеток не настроена на сервере");

        var task = await _db.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new InvalidOperationException("Задача не найдена");

        return await EnqueueCoreAsync(task, quantity, cancellationToken);
    }

    private async Task<PrintJobDto> EnqueueCoreAsync(
        ProductionTask task,
        int quantity,
        CancellationToken cancellationToken)
    {
        var copies = Math.Clamp(quantity, MinCopies, MaxCopies);

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
            Copies = copies,
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
            "Этикетка поставлена в очередь: job {JobId}, task {TaskId}, code {Code}, copies {Copies}",
            job.Id, job.TaskId, job.PickupCode, job.Copies);

        return dto;
    }

    public async Task<PrintCustomLabelsResponseDto> EnqueueTextLabelsAsync(
        IReadOnlyList<CustomLabelRowDto> rows,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Value.AccessToken))
            throw new InvalidOperationException("Печать этикеток не настроена на сервере");

        if (rows.Count == 0)
            throw new InvalidOperationException("Добавьте хотя бы одну строку для печати");

        if (rows.Count > MaxTextLabelRowsPerBatch)
            throw new InvalidOperationException($"За один раз можно печатать не более {MaxTextLabelRowsPerBatch} строк");

        var jobs = new List<PrintJob>(rows.Count);
        foreach (var row in rows)
        {
            var line1 = Truncate(row.Caption, 200) ?? "";
            var line2 = Truncate(row.Region, 200) ?? "";
            var line3 = Truncate(row.Note, 200) ?? "";
            if (line1.Length == 0 && line2.Length == 0 && line3.Length == 0)
                continue;

            var copies = Math.Clamp(row.Quantity, MinCopies, MaxTextLabelCopies);
            jobs.Add(new PrintJob
            {
                TaskId = 0,
                JobType = PrintJobType.TextLabel,
                // OrderTitle/PrimaryComment дублируют строки для понятных уведомлений о статусе.
                OrderTitle = line1.Length > 0 ? line1 : "Наклейка 58×30",
                PrimaryComment = line2,
                PickupCode = "",
                Line1 = line1,
                Line2 = line2,
                Line3 = line3,
                Copies = copies,
                Status = PrintJobStatus.Pending,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (jobs.Count == 0)
            throw new InvalidOperationException("Все строки пустые — нечего печатать");

        _db.PrintJobs.AddRange(jobs);
        await _db.SaveChangesAsync(cancellationToken);

        foreach (var job in jobs)
        {
            var dto = ToDto(job);
            await _printHub.Clients.Group(PrintHub.AgentsGroup).SendAsync(
                PrintHub.JobAvailableMethod,
                dto,
                cancellationToken);
        }

        _logger.LogInformation(
            "Произвольные наклейки в очереди: {Jobs} заданий, всего {Copies} шт.",
            jobs.Count,
            jobs.Sum(j => j.Copies));

        return new PrintCustomLabelsResponseDto
        {
            JobsCreated = jobs.Count,
            TotalCopies = jobs.Sum(j => j.Copies)
        };
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
                    Copies = Math.Max(1, job.Copies),
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
        // Текстовые наклейки не привязаны к заказу — ссылка не нужна.
        if (job.JobType == PrintJobType.OrderLabel && job.TaskId > 0)
        {
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
        }

        return ToDto(job, orderPath);
    }

    private static PrintJobDto ToDto(PrintJob job, string orderPath = "") => new()
    {
        Id = job.Id,
        TaskId = job.TaskId,
        JobType = job.JobType.ToString(),
        OrderTitle = job.OrderTitle,
        PrimaryComment = job.PrimaryComment,
        PickupCode = job.PickupCode ?? "",
        Line1 = job.Line1 ?? "",
        Line2 = job.Line2 ?? "",
        Line3 = job.Line3 ?? "",
        OrderPath = orderPath,
        Copies = Math.Max(1, job.Copies),
        Status = job.Status.ToString(),
        CreatedAt = job.CreatedAt
    };

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
