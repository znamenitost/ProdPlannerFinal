using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class SplitTaskRequest
{
    [Range(1, int.MaxValue)]
    public int ParentTaskId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SplitPart> Parts { get; set; } = new();

    /// <summary>Режим общей задачи: параллельная или последовательная.</summary>
    public SupplyMode? SupplyMode { get; set; }
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

    /// <summary>Порядок этапа (заполняется автоматически при создании).</summary>
    public int SequenceOrder { get; set; }
}
