using System.Globalization;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos.DayPlan;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskCdrPreview;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Services.DayPlan;

public class DayPlanService : IDayPlanService
{
    public const int WorkStartHour = 10;
    public const int WorkEndHour = 19;

    private readonly IProductionTaskRepository _repo;
    private readonly IWorkHoursCalculator _workHours;
    private readonly ITaskCdrPreviewService _cdrPreviewService;
    private readonly ITaskCommentService? _taskComments;

    public DayPlanService(
        IProductionTaskRepository repo,
        IWorkHoursCalculator workHours,
        ITaskCdrPreviewService cdrPreviewService,
        ITaskCommentService? taskComments = null)
    {
        _repo = repo;
        _workHours = workHours;
        _cdrPreviewService = cdrPreviewService;
        _taskComments = taskComments;
    }

    public async Task<DayPlanResponseDto> GetDayPlanAsync(
        string employee,
        string? date,
        DateTime currentTime,
        string? viewerUserId = null,
        CancellationToken cancellationToken = default)
    {
        var nowMoscow = AppDateTime.ToMoscowWallClockFromApp(currentTime);
        var day = ResolveDay(date, nowMoscow);
        var dayStart = day.Date.AddHours(WorkStartHour);
        var dayEnd = day.Date.AddHours(WorkEndHour);
        var spanHours = (dayEnd - dayStart).TotalHours;

        var tasks = await CompactEmployeeRanksAsync(
            await _repo.GetActiveTasksAsync(employee, cancellationToken),
            employee,
            cancellationToken);
        var childTaskIds = tasks
            .Where(t => t.IsSplitTask && t.ParentRowNumber.HasValue)
            .Select(t => t.Id)
            .ToList();
        var splitMetadata = await _repo.GetTaskSplitMetadataByChildTaskIdsAsync(
            childTaskIds, cancellationToken);
        var parentIds = tasks
            .Where(t => t.ParentRowNumber.HasValue)
            .Select(t => t.ParentRowNumber!.Value)
            .Distinct()
            .ToList();
        var siblingsByParent = await _repo.GetSplitChildrenByParentIdsAsync(
            parentIds, cancellationToken);

        var lunchRaw = await _repo.GetLunchIntervalsForDateRangeAsync(
            employee, day.Date, day.Date.AddDays(1), cancellationToken);
        var lunchIntervals = GetLunchIntervalsForDay(lunchRaw, day.Date, nowMoscow, dayEnd);

        var previewIds = await _cdrPreviewService.GetExistingTaskIdsAsync(
            TaskCdrPreviewService.CollectPreviewLookupIds(tasks),
            cancellationToken);

        var taskDtos = tasks.ToDictionary(
            t => t.Id,
            t => MapTask(t, splitMetadata, siblingsByParent, previewIds));

        var packable = tasks
            .Where(t => !t.IsFuss && t.PriorityRank is > 0 && !IsBlocked(t, splitMetadata))
            .Select(t => new DayPlanWavePacker.InputTask(
                t.Id,
                t.PriorityRank!.Value,
                RemainingHours(t),
                t.PriorityOrder))
            .ToList();

        var packed = DayPlanWavePacker.Pack(packable, nowMoscow, _workHours);
        var packedById = packed.ToDictionary(p => p.TaskId);

        var waves = new List<DayPlanWaveDto>();
        var rankedGroups = tasks
            .Where(t => !t.IsFuss && t.PriorityRank is > 0)
            .GroupBy(t => t.PriorityRank!.Value)
            .OrderBy(g => g.Key);

        foreach (var group in rankedGroups)
        {
            var rank = group.Key;
            var waveTasks = group.OrderBy(t => t.PriorityOrder).ThenBy(t => t.Id).ToList();
            var blocked = waveTasks
                .Where(t => IsBlocked(t, splitMetadata))
                .Select(t => taskDtos[t.Id])
                .ToList();

            var blocks = new List<DayPlanBlockDto>();
            var laneCount = 1;
            foreach (var task in waveTasks)
            {
                if (!packedById.TryGetValue(task.Id, out var packedTask))
                    continue;

                laneCount = packedTask.LaneCount;
                foreach (var segment in packedTask.Segments)
                {
                    var start = segment.Start;
                    var end = segment.End;
                    if (end <= dayStart || start >= dayEnd)
                        continue;
                    if (start < dayStart) start = dayStart;
                    if (end > dayEnd) end = dayEnd;

                    foreach (var (segStart, segEnd) in SubtractLunchIntervals(start, end, lunchIntervals))
                    {
                        var hours = (segEnd - segStart).TotalHours;
                        if (hours <= 0) continue;
                        blocks.Add(new DayPlanBlockDto
                        {
                            TaskId = task.Id,
                            Rank = rank,
                            Lane = packedTask.Lane,
                            LaneCount = packedTask.LaneCount,
                            Start = segStart,
                            End = segEnd,
                            Hours = Math.Round(hours, 2),
                            TopPercent = ToPercent((segStart - dayStart).TotalHours, spanHours),
                            HeightPercent = ToPercent(hours, spanHours),
                            Task = taskDtos[task.Id]
                        });
                    }
                }
            }

            var shownIds = blocks.Select(b => b.TaskId).ToHashSet();
            shownIds.UnionWith(blocked.Select(t => t.Id));
            var overflowLane = 0;
            foreach (var task in waveTasks)
            {
                if (shownIds.Contains(task.Id)) continue;
                packedById.TryGetValue(task.Id, out var packedTask);
                var lane = packedTask?.Lane ?? overflowLane++;
                laneCount = Math.Max(laneCount, packedTask?.LaneCount ?? 1);
                blocks.Add(new DayPlanBlockDto
                {
                    TaskId = task.Id,
                    Rank = rank,
                    Lane = lane,
                    LaneCount = packedTask?.LaneCount ?? laneCount,
                    Start = dayEnd,
                    End = dayEnd,
                    Hours = 0,
                    TopPercent = 100,
                    HeightPercent = 0,
                    Task = taskDtos[task.Id]
                });
                shownIds.Add(task.Id);
            }

            double? top = null;
            double? height = null;
            if (blocks.Count > 0)
            {
                top = blocks.Min(b => b.TopPercent);
                var bottom = blocks.Max(b => b.TopPercent + b.HeightPercent);
                height = bottom - top;
            }

            if (blocks.Count == 0 && blocked.Count == 0)
                continue;

            waves.Add(new DayPlanWaveDto
            {
                Rank = rank,
                LaneCount = Math.Max(laneCount, blocked.Count > 0 ? 1 : 0),
                TopPercent = top,
                HeightPercent = height,
                Blocks = blocks,
                Blocked = blocked
            });
        }

        var unplanned = tasks
            .Where(t => t.IsFuss || t.PriorityRank is null or <= 0)
            .Select(t => taskDtos[t.Id])
            .ToList();

        await ApplyCommentBadgeCountsAsync(taskDtos.Values, viewerUserId, cancellationToken);

        var lastPackedEnd = packed
            .SelectMany(p => p.Segments)
            .Select(s => s.End)
            .DefaultIfEmpty(dayStart)
            .Max();
        var tailHours = lastPackedEnd > dayEnd
            ? _workHours.GetWorkHoursBetween(dayEnd, lastPackedEnd)
            : 0;

        return new DayPlanResponseDto
        {
            Date = day.Date,
            CurrentTime = nowMoscow,
            DayStart = dayStart,
            DayEnd = dayEnd,
            PlannedHoursToday = Math.Round(waves.SelectMany(w => w.Blocks).Sum(b => b.Hours), 2),
            TailHours = Math.Round(tailHours, 2),
            TailUntil = tailHours > 0 ? lastPackedEnd : null,
            MaxParallel = waves.Select(w => w.LaneCount).DefaultIfEmpty(1).Max(),
            LunchIntervals = lunchIntervals.Select(i => new DayPlanLunchDto
            {
                StartTime = i.start,
                EndTime = i.end,
                TopPercent = ToPercent((i.start - dayStart).TotalHours, spanHours),
                HeightPercent = ToPercent((i.end - i.start).TotalHours, spanHours)
            }).ToList(),
            Waves = waves,
            Unplanned = unplanned
        };
    }

    private async Task<List<ProductionTask>> CompactEmployeeRanksAsync(
        List<ProductionTask> tasks,
        string employee,
        CancellationToken cancellationToken)
    {
        var ranked = tasks
            .Where(t => !t.IsFuss && t.PriorityRank is > 0)
            .Select(t => new TaskPriorityRankPlanner.RankedTask(
                t.Id, t.PriorityRank!.Value, t.PriorityOrder))
            .ToList();
        var compact = TaskPriorityRankPlanner.CompactRanks(ranked);
        if (compact.Count == 0)
            return tasks;

        await _repo.ExecuteInTransactionAsync(
            ct => _repo.ApplyPriorityRankChangesAsync(compact, ct),
            cancellationToken);
        return await _repo.GetActiveTasksAsync(employee, cancellationToken);
    }

    private async Task ApplyCommentBadgeCountsAsync(
        IEnumerable<DayPlanTaskDto> tasks,
        string? viewerUserId,
        CancellationToken cancellationToken)
    {
        var list = tasks as IList<DayPlanTaskDto> ?? tasks.ToList();
        if (list.Count == 0 || string.IsNullOrWhiteSpace(viewerUserId) || _taskComments == null)
            return;

        var ids = list.Select(t => t.Id).ToList();
        foreach (var task in list)
        {
            if (task.ParentRowNumber is > 0)
                ids.Add(task.ParentRowNumber.Value);
        }

        var counts = await _taskComments.GetUnreadBadgeCountsAsync(ids, viewerUserId, cancellationToken);

        foreach (var task in list)
        {
            counts.TryGetValue(task.Id, out var own);
            var parent = 0;
            if (task.ParentRowNumber is > 0)
                counts.TryGetValue(task.ParentRowNumber.Value, out parent);
            task.CommentBadgeCount = own + parent;
            task.CommentTaskId = own > 0 || parent <= 0 || task.ParentRowNumber is not > 0
                ? task.Id
                : task.ParentRowNumber.Value;
        }
    }

    private static DateTime ResolveDay(string? date, DateTime nowMoscow)
    {
        if (!string.IsNullOrWhiteSpace(date)
            && DateTime.TryParseExact(
                date.Trim(),
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed))
        {
            return parsed.Date;
        }

        return nowMoscow.Date;
    }

    private static DayPlanTaskDto MapTask(
        ProductionTask task,
        IReadOnlyDictionary<int, (SupplyMode SupplyMode, int SequenceOrder)> splitMetadata,
        IReadOnlyDictionary<int, List<ProductionTask>> siblingsByParent,
        ISet<int> previewIds)
    {
        splitMetadata.TryGetValue(task.Id, out var meta);
        var supplyMode = meta.SupplyMode != default ? meta.SupplyMode : task.SupplyMode;
        var sequenceOrder = meta.SequenceOrder;
        var partners = new List<string>();
        if (task.ParentRowNumber is > 0
            && siblingsByParent.TryGetValue(task.ParentRowNumber.Value, out var siblings))
        {
            partners = siblings
                .Where(c => c.Id != task.Id)
                .Select(c => c.EmployeeName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        var blocked = IsBlocked(task, splitMetadata);
        return new DayPlanTaskDto
        {
            Id = task.Id,
            Title = task.TaskDisplayName,
            FolderPath = task.FolderPath ?? "",
            FileName = task.FileName ?? "",
            Type = task.Type ?? "",
            StatusText = TaskStatusMapper.ToDisplayText(task),
            Status = (int)task.Status,
            PriorityRank = task.PriorityRank is > 0 ? task.PriorityRank : null,
            RemainingHours = Math.Round(RemainingHours(task), 2),
            Deadline = task.Deadline,
            IsSplitTask = task.IsSplitTask,
            ParentRowNumber = task.ParentRowNumber,
            SupplyMode = (int)supplyMode,
            SequenceOrder = sequenceOrder,
            SequenceStartBlocked = supplyMode == SupplyMode.InternalProduction && task.Status == JobStatus.Waiting,
            Blocked = blocked,
            IsFuss = task.IsFuss,
            HasCdrPreview = TaskCdrPreviewService.HasPreview(task.Id, task.ParentRowNumber, previewIds),
            Comment = task.Comment ?? "",
            CommentTaskId = task.Id,
            PartnerNames = partners
        };
    }

    private static bool IsBlocked(
        ProductionTask task,
        IReadOnlyDictionary<int, (SupplyMode SupplyMode, int SequenceOrder)> splitMetadata)
    {
        if (task.Status is JobStatus.PendingApproval or JobStatus.NoItems or JobStatus.Waiting)
            return true;

        splitMetadata.TryGetValue(task.Id, out var meta);
        var supplyMode = meta.SupplyMode != default ? meta.SupplyMode : task.SupplyMode;
        return supplyMode == SupplyMode.InternalProduction && task.Status == JobStatus.Waiting;
    }

    private static double RemainingHours(ProductionTask task) =>
        Math.Max(0, task.EstimateHours * (1 - task.Progress));

    private static double ToPercent(double hours, double spanHours)
    {
        if (spanHours <= 0) return 0;
        return Math.Round(Math.Clamp(hours / spanHours * 100, 0, 100), 2);
    }

    private static List<(DateTime start, DateTime end)> GetLunchIntervalsForDay(
        List<LunchInterval> lunchIntervals,
        DateTime dayDate,
        DateTime currentTime,
        DateTime dayEndTime)
    {
        var result = new List<(DateTime start, DateTime end)>();
        var dayStartTime = dayDate.AddHours(WorkStartHour);

        foreach (var interval in lunchIntervals)
        {
            var start = AppDateTime.ToMoscowWallClockFromDb(interval.StartTime);
            var end = interval.EndTime.HasValue
                ? AppDateTime.ToMoscowWallClockFromDb(interval.EndTime.Value)
                : currentTime;

            if (start.Date > dayDate || end.Date < dayDate)
                continue;

            var startInDay = start > dayStartTime ? start : dayStartTime;
            var endInDay = end < dayEndTime ? end : dayEndTime;
            if (startInDay < endInDay)
                result.Add((startInDay, endInDay));
        }

        return result.OrderBy(i => i.start).ToList();
    }

    private static List<(DateTime start, DateTime end)> SubtractLunchIntervals(
        DateTime start,
        DateTime end,
        List<(DateTime start, DateTime end)> lunchIntervals)
    {
        var segments = new List<(DateTime start, DateTime end)> { (start, end) };

        foreach (var lunch in lunchIntervals)
        {
            var next = new List<(DateTime start, DateTime end)>();
            foreach (var segment in segments)
            {
                if (segment.end <= lunch.start || segment.start >= lunch.end)
                {
                    next.Add(segment);
                    continue;
                }

                if (segment.start < lunch.start)
                    next.Add((segment.start, lunch.start));
                if (segment.end > lunch.end)
                    next.Add((lunch.end, segment.end));
            }

            segments = next;
            if (segments.Count == 0)
                break;
        }

        return segments.Where(s => s.start < s.end).ToList();
    }
}
