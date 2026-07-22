namespace ProductionPlanner.Models;

/// <summary>Опциональный комментарий при старте (обязателен для «Суеты»).</summary>
public class StartTaskRequest
{
    public string? Comment { get; set; }
}
