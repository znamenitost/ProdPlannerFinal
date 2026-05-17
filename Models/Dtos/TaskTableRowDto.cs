using ProductionPlanner.Models;

namespace ProductionPlanner.Models.Dtos;

public class TaskTableRowDto
{
    public int Id { get; set; }
    public int DisplayOrder { get; set; }
    public string FolderPath { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Comment { get; set; } = "";
    public string StatusText { get; set; } = "";
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string Type { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int? ParentRowNumber { get; set; }
    public bool IsSplitTask { get; set; }
    public double Progress { get; set; }
    public bool HasCurrentUserSubtask { get; set; }

    public static TaskTableRowDto FromParent(
        ProductionTask parent,
        string statusText,
        bool hasCurrentUserSubtask) => new()
    {
        Id = parent.Id,
        DisplayOrder = parent.DisplayOrder,
        FolderPath = parent.FolderPath,
        FileName = parent.FileName,
        Comment = parent.Comment,
        StatusText = statusText,
        Deadline = parent.Deadline,
        EstimateHours = parent.EstimateHours,
        Type = parent.Type,
        EmployeeName = parent.EmployeeName,
        CreatedAt = parent.CreatedAt,
        UpdatedAt = parent.UpdatedAt,
        ParentRowNumber = parent.ParentRowNumber,
        IsSplitTask = parent.IsSplitTask,
        Progress = parent.Progress,
        HasCurrentUserSubtask = hasCurrentUserSubtask
    };
}
