namespace ProductionPlanner.Models;

public class CreateTaskRequest
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string? Type { get; set; }
    public string? EmployeeName { get; set; }
    public int? ParentRowNumber { get; set; }
}

public class UpdateTaskRequest
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }
    public DateTime Deadline { get; set; }
    public double EstimateHours { get; set; }
    public string? Type { get; set; }
    public string? EmployeeName { get; set; }
    public int? ParentRowNumber { get; set; }
    public string? StatusText { get; set; }
}
