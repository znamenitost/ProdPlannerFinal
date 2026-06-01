using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class TaskStatusMapper
{
    public static string ToText(JobStatus status) => status switch
    {
        JobStatus.Assigned => "Назначена",
        JobStatus.InProgress => "Начал",
        JobStatus.Paused => "Пауза",
        JobStatus.Completed => "Готово",
        JobStatus.PendingApproval => "Согласование",
        JobStatus.NoItems => "Нет изделий",
        JobStatus.Approved => "Согласовано",
        JobStatus.InStock => "В наличии",
        JobStatus.Waiting => "Ожидание",
        _ => ""
    };

    public static JobStatus FromText(string statusText) => statusText switch
    {
        "Готово" => JobStatus.Completed,
        "Начал" => JobStatus.InProgress,
        "Пауза" => JobStatus.Paused,
        "Назначена" => JobStatus.Assigned,
        "Согласование" => JobStatus.PendingApproval,
        "На согласовании" => JobStatus.PendingApproval,
        "Нет изделий" => JobStatus.NoItems,
        "Согласовано" => JobStatus.Approved,
        "В наличии" => JobStatus.InStock,
        "Ожидание" => JobStatus.Waiting,
        "" => JobStatus.Assigned,
        _ => JobStatus.Assigned
    };

    public static bool IsEmployeeInfoStatus(JobStatus status) =>
        status is JobStatus.PendingApproval or JobStatus.NoItems;

    public static bool IsCalendarPendingHighlight(JobStatus status) =>
        status == JobStatus.PendingApproval;

    public static bool UsesNormalCalendarColor(JobStatus status) =>
        status is JobStatus.Approved or JobStatus.InStock or JobStatus.Assigned
            or JobStatus.InProgress or JobStatus.Paused or JobStatus.Completed
            or JobStatus.Waiting;
}
