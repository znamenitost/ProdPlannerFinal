namespace ProductionPlanner.Models.Dtos;

public class PrintJobDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string OrderTitle { get; set; } = "";
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    /// <summary>Относительный путь страницы заказа, например /t/{token}?c=А42.</summary>
    public string OrderPath { get; set; } = "";
    /// <summary>Число копий этикетки.</summary>
    public int Copies { get; set; } = 1;
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class PrintLabelRequestDto
{
    /// <summary>Сколько наклеек поставить в очередь (1–50).</summary>
    public int Quantity { get; set; } = 1;
}

public class PrintJobStatusUpdateDto
{
    public string? AgentName { get; set; }
    public string? ErrorMessage { get; set; }
}

public class LabelPrintStatusDto
{
    public int JobId { get; set; }
    public int TaskId { get; set; }
    public string Status { get; set; } = "";
    public string OrderTitle { get; set; } = "";
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public int Copies { get; set; } = 1;
    public string? ErrorMessage { get; set; }
}
