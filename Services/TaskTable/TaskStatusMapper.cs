using ProductionPlanner.Models;

namespace ProductionPlanner.Services.TaskTable;

public static class TaskStatusMapper
{
    /// <summary>Отображаемый статус после выдачи клиенту (JobStatus остаётся Completed).</summary>
    public const string PickedUpText = "Выдан";

    /// <summary>Отображаемый статус Assigned для задач «Суета».</summary>
    public const string FussAssignedText = "Суета";

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

    /// <summary>Если заказ выдан — статус показываем как «Выдан».</summary>
    public static string ApplyPickedUpDisplay(ProductionTask task, string statusText)
    {
        if (task.PickedUpAt == null)
            return statusText;

        return PickedUpText;
    }

    /// <summary>Для «Суеты» Assigned показываем как «Суета», не «Назначена».</summary>
    public static string ApplyFussAssignedDisplay(ProductionTask task, string statusText)
    {
        if (!task.IsFuss)
            return statusText;

        if (string.IsNullOrEmpty(statusText) || statusText == "Назначена")
            return FussAssignedText;

        return statusText;
    }

    public static string ToDisplayText(ProductionTask task) =>
        ApplyFussAssignedDisplay(task, ApplyPickedUpDisplay(task, ToText(task.Status)));

    public static string FormatStatus(ProductionTask task, string statusText) =>
        ApplyFussAssignedDisplay(task, ApplyPickedUpDisplay(task, statusText));

    public static JobStatus FromText(string statusText) => statusText switch
    {
        "Готово" => JobStatus.Completed,
        "Выдан" => JobStatus.Completed,
        "Начал" => JobStatus.InProgress,
        "Пауза" => JobStatus.Paused,
        "Назначена" => JobStatus.Assigned,
        "Суета" => JobStatus.Assigned,
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
