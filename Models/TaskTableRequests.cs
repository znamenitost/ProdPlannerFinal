using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class CreateTaskRequest : IValidatableObject
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }

    [Required]
    public DateTime Deadline { get; set; }

    [Range(0.01, 1000)]
    public double EstimateHours { get; set; }

    public string? Type { get; set; }

    /// <summary>
    /// Исполнитель для одиночной задачи. Может быть пустым, когда задача создаётся
    /// общей через <see cref="Parts"/>: тогда исполнители берутся из частей,
    /// а у родительской записи поле остаётся пустым.
    /// </summary>
    public string? EmployeeName { get; set; }

    public int? ParentRowNumber { get; set; }

    /// <summary>Назначения для общей задачи (2+ сотрудника — создаётся родитель и дочерние).</summary>
    public List<SplitPart>? Parts { get; set; }

    /// <summary>Режим выполнения: 0 — обычная, 1 — последовательная, 2 — параллельная (общая).</summary>
    public SupplyMode SupplyMode { get; set; }

    public bool RequiresTestBeforeProduction { get; set; }

    [Range(0, 1000)]
    public double TestEstimateHours { get; set; }

    [Range(0, 1000)]
    public double ProductionEstimateHours { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var validParts = Parts?
            .Where(p => p != null
                && !string.IsNullOrWhiteSpace(p.EmployeeName)
                && p.AllocatedHours > 0)
            .ToList();

        var hasMultipleParts = validParts is { Count: >= 2 };
        var hasEmployee = !string.IsNullOrWhiteSpace(EmployeeName);

        if (!hasMultipleParts && !hasEmployee)
        {
            yield return new ValidationResult(
                "Укажите сотрудника или задайте 2+ части для общей задачи.",
                new[] { nameof(EmployeeName) });
        }

        if (RequiresTestBeforeProduction && !hasMultipleParts)
        {
            if (TestEstimateHours < 0.5 || ProductionEstimateHours < 0.5)
            {
                yield return new ValidationResult(
                    "Укажите часы теста и основной части (от 0.5).",
                    new[] { nameof(TestEstimateHours) });
            }
        }

        if (validParts != null)
        {
            foreach (var part in validParts.Where(p => p.RequiresTestBeforeProduction))
            {
                if (part.TestEstimateHours < 0.5 || part.ProductionEstimateHours < 0.5)
                {
                    yield return new ValidationResult(
                        "Укажите часы теста и основной части (от 0.5) для каждого назначения.",
                        new[] { nameof(Parts) });
                }
            }
        }
    }
}

public class UpdateTaskRequest
{
    public string? FolderPath { get; set; }
    public string? FileName { get; set; }
    public string? Comment { get; set; }

    [Required]
    public DateTime Deadline { get; set; }

    [Range(0.01, 1000)]
    public double EstimateHours { get; set; }

    public string? Type { get; set; }

    /// <summary>
    /// Исполнитель одиночной задачи. У общей задачи (родителя со сплитом) поле может
    /// быть пустым — назначения хранятся в дочерних задачах. Финальная проверка
    /// делается в <see cref="ProductionPlanner.Services.TaskTable.TaskTableService"/>,
    /// где известно состояние существующей записи.
    /// </summary>
    public string? EmployeeName { get; set; }

    public int? ParentRowNumber { get; set; }
    public string? StatusText { get; set; }
    public bool? PriorityMarked { get; set; }

    /// <summary>Ручной обход очереди этапов (Waiting → Assigned).</summary>
    public bool SequenceOverride { get; set; }

    /// <summary>Оптимистичная блокировка: метка версии строки с клиента (<see cref="TaskTableRowDto.UpdatedAt"/>).</summary>
    public DateTime? ExpectedUpdatedAt { get; set; }
}

public class UpdateWorkIntervalsRequest
{
    public List<WorkIntervalUpdateItem> Intervals { get; set; } = new();
}

public class WorkIntervalUpdateItem
{
    public int Id { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
