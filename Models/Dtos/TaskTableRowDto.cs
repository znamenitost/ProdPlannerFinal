using ProductionPlanner.Models;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Models.Dtos;

public class TaskTableRowDto
{
    public int Id { get; set; }
    public int DisplayOrder { get; set; }
    public string FolderPath { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Comment { get; set; } = "";
    public string StatusText { get; set; } = "";
    public JobStatus Status { get; set; }
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string Type { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int? ParentRowNumber { get; set; }
    public bool IsSplitTask { get; set; }
    public SupplyMode SupplyMode { get; set; }
    public double Progress { get; set; }
    public bool HasCurrentUserSubtask { get; set; }
    /// <summary>Имена сотрудников дочерних подзадач (через «/») для общих задач.</summary>
    public string SplitEmployeeNames { get; set; } = "";

    public List<WorkIntervalDto> WorkIntervals { get; set; } = new();

    /// <summary>Плановый % по времени (отработано / выделено), 0–100.</summary>
    public double PlannedTimeProgress { get; set; }

    public bool ShowPlannedTimeProgress { get; set; }

    public bool RequiresTestBeforeProduction { get; set; }

    public double TestEstimateHours { get; set; }

    public double ProductionEstimateHours { get; set; }

    public TaskWorkPhase WorkPhase { get; set; }

    /// <summary>Порядок этапа для дочерней подзадачи (из TaskSplits).</summary>
    public int SequenceOrder { get; set; }

    public bool SequenceStartBlocked { get; set; }

    public bool HasCdrPreview { get; set; }

    /// <summary>Маркер «через согласование» (для родителя split — агрегат по детям).</summary>
    public bool ShowsThroughApproval { get; set; }

    public static TaskTableRowDto FromParent(
        ProductionTask parent,
        string statusText,
        bool hasCurrentUserSubtask,
        IReadOnlyList<ProductionTask>? children = null,
        IReadOnlyList<WorkInterval>? workIntervals = null,
        DateTime? now = null,
        IReadOnlyDictionary<int, IReadOnlyList<WorkInterval>>? childIntervalsByTaskId = null)
    {
        var splitEmployeeNames = "";
        if (parent.IsSplitTask && children is { Count: > 0 })
        {
            splitEmployeeNames = string.Join("/",
                children
                    .Select(c => c.EmployeeName)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct());
        }

        var at = now ?? DateTime.UtcNow;
        var intervals = workIntervals ?? Array.Empty<WorkInterval>();
        var isSplitWithChildren = parent.IsSplitTask && children is { Count: > 0 };
        var childIntervals = childIntervalsByTaskId
            ?? new Dictionary<int, IReadOnlyList<WorkInterval>>();
        var phaseEstimate = TestPhaseWorkflow.GetActiveEstimateHours(parent);
        var progressIntervals = TestPhaseWorkflow.GetIntervalsForProgress(parent, intervals.ToList());

        return new TaskTableRowDto
        {
            Id = parent.Id,
            DisplayOrder = parent.DisplayOrder,
            FolderPath = parent.FolderPath,
            FileName = parent.FileName,
            Comment = parent.Comment,
            StatusText = statusText,
            Status = parent.Status,
            Deadline = parent.Deadline,
            EstimateHours = parent.EstimateHours,
            Type = parent.Type,
            EmployeeName = parent.EmployeeName,
            CreatedAt = parent.CreatedAt,
            UpdatedAt = parent.UpdatedAt,
            ParentRowNumber = parent.ParentRowNumber,
            IsSplitTask = parent.IsSplitTask,
            SupplyMode = parent.SupplyMode,
            Progress = parent.Progress,
            HasCurrentUserSubtask = hasCurrentUserSubtask,
            SplitEmployeeNames = splitEmployeeNames,
            WorkIntervals = intervals.Select(WorkIntervalDto.FromEntity).ToList(),
            PlannedTimeProgress = isSplitWithChildren
                ? PlannedTimeProgressCalculator.GetSplitParentPercent(children!, childIntervals, at)
                : PlannedTimeProgressCalculator.GetPercent(
                    parent, progressIntervals, at, phaseEstimate),
            ShowPlannedTimeProgress = isSplitWithChildren
                ? PlannedTimeProgressCalculator.ShouldShowSplitParent(children!, childIntervals, statusText)
                : PlannedTimeProgressCalculator.ShouldShow(parent, progressIntervals, phaseEstimate)
                    || statusText is "Начал" or "Пауза",
            RequiresTestBeforeProduction = parent.RequiresTestBeforeProduction,
            TestEstimateHours = parent.TestEstimateHours,
            ProductionEstimateHours = parent.ProductionEstimateHours,
            WorkPhase = parent.WorkPhase,
            ShowsThroughApproval = TestPhaseWorkflow.TaskShowsThroughApproval(parent, children)
        };
    }
}
