using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class TaskStatusMapper
{
    public static string ToText(JobStatus status) => status switch
    {
        JobStatus.Assigned => "",
        JobStatus.InProgress => "Начал",
        JobStatus.Paused => "Пауза",
        JobStatus.Completed => "Готово",
        _ => ""
    };

    public static JobStatus FromText(string statusText) => statusText switch
    {
        "Готово" => JobStatus.Completed,
        "Начал" => JobStatus.InProgress,
        "Пауза" => JobStatus.Paused,
        _ => JobStatus.Assigned
    };
}
