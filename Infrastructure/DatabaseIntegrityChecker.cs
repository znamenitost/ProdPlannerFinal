using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Infrastructure;

public sealed record DbIntegritySample(
    int Id,
    string Title,
    string File,
    string? Note);

public sealed record DbIntegrityCheck(
    string Id,
    string Title,
    string Severity,
    int Count,
    IReadOnlyList<int> SampleIds,
    IReadOnlyList<DbIntegritySample> Samples,
    string? Hint);

public sealed record DbIntegrityReport(
    bool Ok,
    DateTime CapturedAt,
    IReadOnlyList<DbIntegrityCheck> Checks);

public static class DatabaseIntegrityChecker
{
    private const int SampleLimit = 25;

    public static async Task<DbIntegrityReport> RunAsync(
        ApplicationDbContext db,
        IWorkHoursCalculator workHours,
        CancellationToken cancellationToken = default)
    {
        var checks = new List<DbIntegrityCheck>
        {
            await OrphanChildrenAsync(db, cancellationToken),
            await SplitParentWithoutChildrenAsync(db, cancellationToken),
            await OrphanTaskSplitsAsync(db, cancellationToken),
            await SplitChildWithoutRecordAsync(db, cancellationToken),
            await MultipleOpenIntervalsAsync(db, cancellationToken),
            await CompletedWithOpenIntervalAsync(db, cancellationToken),
            await InProgressWithoutOpenIntervalAsync(db, cancellationToken),
            await PausedWithOpenIntervalAsync(db, cancellationToken),
            await InvalidIntervalRangeAsync(db, cancellationToken),
            await TestPhaseWithoutFlagAsync(db, cancellationToken),
            await TestFlagWithoutHoursAsync(db, cancellationToken),
            await ActualHoursDriftAsync(db, workHours, cancellationToken)
        };

        var ok = checks.All(c => c.Count == 0);
        var enriched = await EnrichSamplesAsync(db, checks, cancellationToken);
        return new DbIntegrityReport(ok, DateTime.UtcNow, enriched);
    }

    private static async Task<DbIntegrityCheck> OrphanChildrenAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.ParentRowNumber != null)
            .Where(t => !db.ProductionTasks.Any(p => p.Id == t.ParentRowNumber!.Value))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "orphan_children",
            "Дочерние задачи без родителя",
            "warning",
            ids,
            "Проверьте ParentRowNumber или удалите сиротские подзадачи.");
    }

    private static async Task<DbIntegrityCheck> SplitParentWithoutChildrenAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var parentIds = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.IsSplitTask && t.ParentRowNumber == null)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (parentIds.Count == 0)
        {
            return Check("split_parent_without_children", "Общая задача без подзадач", "warning", ids: []);
        }

        var parentsWithChildren = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.ParentRowNumber != null)
            .Select(t => t.ParentRowNumber!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        var withChildren = parentsWithChildren.ToHashSet();

        var ids = parentIds.Where(id => !withChildren.Contains(id)).ToList();
        return Check(
            "split_parent_without_children",
            "Общая задача без подзадач",
            "warning",
            ids,
            "У родителя IsSplitTask=true, но нет дочерних строк.");
    }

    private static async Task<DbIntegrityCheck> OrphanTaskSplitsAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.TaskSplits
            .AsNoTracking()
            .Where(s => !db.ProductionTasks.Any(t => t.Id == s.ChildTaskId)
                || !db.ProductionTasks.Any(t => t.Id == s.ParentRowNumber))
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "orphan_task_splits",
            "Записи TaskSplits без задачи",
            "error",
            ids,
            "Удалите битые записи TaskSplits или восстановите связанные задачи.");
    }

    private static async Task<DbIntegrityCheck> SplitChildWithoutRecordAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var childIds = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.ParentRowNumber != null)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (childIds.Count == 0)
        {
            return Check("split_child_without_record", "Подзадача без записи в TaskSplits", "warning", ids: []);
        }

        var splitChildIds = await db.TaskSplits
            .AsNoTracking()
            .Select(s => s.ChildTaskId)
            .ToListAsync(cancellationToken);
        var splitSet = splitChildIds.ToHashSet();

        var ids = childIds.Where(id => !splitSet.Contains(id)).ToList();
        return Check(
            "split_child_without_record",
            "Подзадача без записи в TaskSplits",
            "warning",
            ids,
            "Для дочерней задачи нет строки в TaskSplits.");
    }

    private static async Task<DbIntegrityCheck> MultipleOpenIntervalsAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.WorkIntervals
            .AsNoTracking()
            .Where(i => i.EndTime == null)
            .GroupBy(i => i.ProductionTaskId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);

        return Check(
            "multiple_open_intervals",
            "Несколько открытых интервалов на задачу",
            "error",
            ids,
            "Закройте лишние интервалы (debug: close-interval) или вручную в БД.");
    }

    private static async Task<DbIntegrityCheck> CompletedWithOpenIntervalAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.Status == JobStatus.Completed)
            .Where(t => t.WorkIntervals.Any(i => i.EndTime == null))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "completed_with_open_interval",
            "Завершена, но интервал открыт",
            "warning",
            ids,
            "Закройте открытый интервал у завершённой задачи.");
    }

    private static async Task<DbIntegrityCheck> InProgressWithoutOpenIntervalAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.Status == JobStatus.InProgress)
            .Where(t => !(t.IsSplitTask && t.ParentRowNumber == null))
            .Where(t => !t.WorkIntervals.Any(i => i.EndTime == null))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "in_progress_without_open_interval",
            "В работе без открытого интервала",
            "warning",
            ids,
            "Поставьте на паузу и продолжите или создайте интервал вручную. Для общих задач интервалы учитываются у подзадач.");
    }

    private static async Task<DbIntegrityCheck> PausedWithOpenIntervalAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.Status == JobStatus.Paused)
            .Where(t => t.WorkIntervals.Any(i => i.EndTime == null))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "paused_with_open_interval",
            "На паузе с открытым интервалом",
            "error",
            ids,
            "При паузе интервал должен быть закрыт.");
    }

    private static async Task<DbIntegrityCheck> InvalidIntervalRangeAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.WorkIntervals
            .AsNoTracking()
            .Where(i => i.EndTime != null && i.EndTime < i.StartTime)
            .Select(i => i.ProductionTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return Check(
            "invalid_interval_range",
            "Интервал с EndTime раньше StartTime",
            "error",
            ids,
            "Исправьте время начала/окончания интервала.");
    }

    private static async Task<DbIntegrityCheck> TestPhaseWithoutFlagAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => !t.RequiresTestBeforeProduction
                && (t.WorkPhase == TaskWorkPhase.Test
                    || t.WorkPhase == TaskWorkPhase.AwaitingApproval
                    || t.WorkPhase == TaskWorkPhase.Production))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "test_phase_without_flag",
            "Фаза «через согласование» без флага",
            "warning",
            ids,
            "Включите RequiresTestBeforeProduction или сбросьте WorkPhase.");
    }

    private static async Task<DbIntegrityCheck> TestFlagWithoutHoursAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var ids = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => t.RequiresTestBeforeProduction
                && (t.TestEstimateHours < 0.5 || t.ProductionEstimateHours < 0.5))
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        return Check(
            "test_flag_without_hours",
            "«Через согласование» без часов теста/основной части",
            "warning",
            ids,
            "Укажите TestEstimateHours и ProductionEstimateHours (от 0.5).");
    }

    private static async Task<DbIntegrityCheck> ActualHoursDriftAsync(
        ApplicationDbContext db,
        IWorkHoursCalculator workHours,
        CancellationToken cancellationToken)
    {
        const int batchSize = 100;
        var ids = new List<int>();
        var lastId = 0;

        while (true)
        {
            var tasks = await db.ProductionTasks
                .AsNoTracking()
                .Include(t => t.WorkIntervals)
                .Where(t => t.Id > lastId)
                .Where(t => t.Status == JobStatus.Completed
                    && !(t.IsSplitTask && t.ParentRowNumber == null))
                .OrderBy(t => t.Id)
                .Take(batchSize)
                .ToListAsync(cancellationToken);

            if (tasks.Count == 0)
                break;

            foreach (var task in tasks)
            {
                lastId = task.Id;
                var actual = CalculateActualHours(task.WorkIntervals, workHours);
                if (Math.Abs(task.ActualHours - actual) > 0.01)
                    ids.Add(task.Id);
            }
        }

        return Check(
            "actual_hours_drift",
            "ActualHours не совпадает с интервалами",
            "info",
            ids,
            "Выполните «Пересчитать статистику» на этой странице.");
    }

    private static double CalculateActualHours(
        IEnumerable<WorkInterval> intervals,
        IWorkHoursCalculator workHours)
    {
        var total = intervals
            .Where(i => i.EndTime.HasValue)
            .Sum(i => workHours.GetWorkHoursBetween(
                AppDateTime.ToMoscowWallClockFromDb(i.StartTime),
                AppDateTime.ToMoscowWallClockFromDb(i.EndTime!.Value)));

        return Math.Round(total, 2);
    }

    private static DbIntegrityCheck Check(
        string id,
        string title,
        string severity,
        IReadOnlyList<int> ids,
        string? hint = null)
    {
        return new DbIntegrityCheck(
            id,
            title,
            severity,
            ids.Count,
            ids.Take(SampleLimit).ToList(),
            [],
            hint);
    }

    private static async Task<IReadOnlyList<DbIntegrityCheck>> EnrichSamplesAsync(
        ApplicationDbContext db,
        IReadOnlyList<DbIntegrityCheck> checks,
        CancellationToken cancellationToken)
    {
        var result = new List<DbIntegrityCheck>(checks.Count);
        foreach (var check in checks)
        {
            if (check.SampleIds.Count == 0)
            {
                result.Add(check);
                continue;
            }

            var samples = check.Id == "orphan_task_splits"
                ? await LoadSplitSamplesAsync(db, check.SampleIds, cancellationToken)
                : await LoadTaskSamplesAsync(db, check.SampleIds, cancellationToken);

            result.Add(check with { Samples = samples });
        }

        return result;
    }

    private static async Task<IReadOnlyList<DbIntegritySample>> LoadTaskSamplesAsync(
        ApplicationDbContext db,
        IReadOnlyList<int> sampleIds,
        CancellationToken cancellationToken)
    {
        var rows = await db.ProductionTasks
            .AsNoTracking()
            .Where(t => sampleIds.Contains(t.Id))
            .Select(t => new TaskLabelRow(t.Id, t.FolderPath, t.FileName))
            .ToListAsync(cancellationToken);

        var byId = rows.ToDictionary(r => r.Id);

        return sampleIds
            .Select(id => byId.TryGetValue(id, out var row)
                ? ToSample(row)
                : new DbIntegritySample(id, "—", "—", "задача не найдена в БД"))
            .ToList();
    }

    private static async Task<IReadOnlyList<DbIntegritySample>> LoadSplitSamplesAsync(
        ApplicationDbContext db,
        IReadOnlyList<int> splitIds,
        CancellationToken cancellationToken)
    {
        var splits = await db.TaskSplits
            .AsNoTracking()
            .Where(s => splitIds.Contains(s.Id))
            .Select(s => new { s.Id, s.ParentRowNumber, s.ChildTaskId })
            .ToListAsync(cancellationToken);

        var bySplitId = splits.ToDictionary(s => s.Id);
        var taskIds = splits
            .SelectMany(s => new[] { s.ParentRowNumber, s.ChildTaskId })
            .Distinct()
            .ToList();

        var taskRows = taskIds.Count == 0
            ? []
            : await db.ProductionTasks
                .AsNoTracking()
                .Where(t => taskIds.Contains(t.Id))
                .Select(t => new TaskLabelRow(t.Id, t.FolderPath, t.FileName))
                .ToListAsync(cancellationToken);

        var tasksById = taskRows.ToDictionary(r => r.Id);

        return splitIds
            .Select(splitId =>
            {
                if (!bySplitId.TryGetValue(splitId, out var split))
                    return new DbIntegritySample(splitId, "—", "—", "запись TaskSplits не найдена");

                tasksById.TryGetValue(split.ChildTaskId, out var child);
                tasksById.TryGetValue(split.ParentRowNumber, out var parent);
                var row = child ?? parent;

                var note = $"TaskSplits #{splitId}, родитель {split.ParentRowNumber}, дочерняя {split.ChildTaskId}";
                if (row == null)
                    return new DbIntegritySample(split.ChildTaskId, "—", "—", note);

                return ToSample(row) with { Note = note };
            })
            .ToList();
    }

    private sealed record TaskLabelRow(int Id, string FolderPath, string FileName);

    private static DbIntegritySample ToSample(TaskLabelRow row) =>
        new(row.Id, GetTaskDisplayName(row.FolderPath, row.FileName), GetTaskFullPath(row.FolderPath, row.FileName), null);

    private static string GetTaskDisplayName(string folderPath, string fileName)
    {
        if (!string.IsNullOrEmpty(folderPath))
        {
            var segments = folderPath.Split(['/', '\\'], StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length > 0)
                return segments[^1];
        }

        return string.IsNullOrWhiteSpace(fileName) ? "—" : fileName;
    }

    private static string GetTaskFullPath(string folderPath, string fileName) =>
        string.IsNullOrEmpty(folderPath)
            ? (string.IsNullOrWhiteSpace(fileName) ? "—" : fileName)
            : $"{folderPath}/{fileName}";
}
