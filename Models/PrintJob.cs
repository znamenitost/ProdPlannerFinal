namespace ProductionPlanner.Models;

public enum PrintJobStatus
{
    Pending = 0,
    Claimed = 1,
    Printing = 2,
    Printed = 3,
    Failed = 4
}

public class PrintJob
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    /// <summary>Имя заказчика = последняя папка (например «Арета»).</summary>
    public string OrderTitle { get; set; } = "";
    /// <summary>Имя файла задачи без расширения (для строки под заголовком).</summary>
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public PrintJobStatus Status { get; set; } = PrintJobStatus.Pending;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AgentName { get; set; }
}
