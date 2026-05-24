using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class SplitTaskRequest
{
    [Range(1, int.MaxValue)]
    public int ParentTaskId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SplitPart> Parts { get; set; } = new();
}

public class SplitPart
{
    public int? ChildTaskId { get; set; }

    [Required]
    [MinLength(1)]
    public string EmployeeName { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public string TaskType { get; set; } = string.Empty;

    [Range(0.01, 1000)]
    public double AllocatedHours { get; set; }
}
