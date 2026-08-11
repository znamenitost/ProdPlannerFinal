namespace ProductionPlanner.Models;

public enum PrintJobStatus
{
    Pending = 0,
    Claimed = 1,
    Printing = 2,
    Printed = 3,
    Failed = 4
}

public enum PrintJobType
{
    /// <summary>Этикетка заказа 75×120 мм (заказчик + код получения).</summary>
    OrderLabel = 0,
    /// <summary>Произвольная наклейка 58×30 мм: три строки текста (Line1–Line3).</summary>
    TextLabel = 1
}

public class PrintJob
{
    public int Id { get; set; }
    /// <summary>Для TextLabel = 0 (к задаче не привязана).</summary>
    public int TaskId { get; set; }
    public PrintJobType JobType { get; set; } = PrintJobType.OrderLabel;
    /// <summary>Имя заказчика = последняя папка (например «Арета»).</summary>
    public string OrderTitle { get; set; } = "";
    /// <summary>Имя файла задачи без расширения (для строки под заголовком).</summary>
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    /// <summary>TextLabel: строка 1 (Подпись).</summary>
    public string Line1 { get; set; } = "";
    /// <summary>TextLabel: строка 2 (Регион).</summary>
    public string Line2 { get; set; } = "";
    /// <summary>TextLabel: строка 3 (Примечание).</summary>
    public string Line3 { get; set; } = "";
    /// <summary>Сколько копий этикетки напечатать (минимум 1).</summary>
    public int Copies { get; set; } = 1;
    public PrintJobStatus Status { get; set; } = PrintJobStatus.Pending;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AgentName { get; set; }
}
