namespace ProductionPlanner.Models.Dtos;

public class PrintJobDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    /// <summary>OrderLabel | TextLabel</summary>
    public string JobType { get; set; } = "";
    public string OrderTitle { get; set; } = "";
    public string PrimaryComment { get; set; } = "";
    public string PickupCode { get; set; } = "";
    /// <summary>TextLabel: строки 1–3 наклейки 58×30 мм.</summary>
    public string Line1 { get; set; } = "";
    public string Line2 { get; set; } = "";
    public string Line3 { get; set; } = "";
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

/// <summary>Строка редактируемой таблицы произвольных наклеек 58×30.</summary>
public class CustomLabelRowDto
{
    /// <summary>Строка 1 — Подпись.</summary>
    public string Caption { get; set; } = "";
    /// <summary>Строка 2 — Регион.</summary>
    public string Region { get; set; } = "";
    /// <summary>Строка 3 — Примечание.</summary>
    public string Note { get; set; } = "";
    /// <summary>Сколько наклеек печатать (1–200).</summary>
    public int Quantity { get; set; } = 1;
}

/// <summary>Сохраняемое содержимое таблицы произвольных наклеек.</summary>
public class CustomLabelSheetDto
{
    public List<CustomLabelRowDto> Rows { get; set; } = new();
}

public class PrintCustomLabelsRequestDto
{
    public List<CustomLabelRowDto> Rows { get; set; } = new();
}

public class PrintCustomLabelsResponseDto
{
    public int JobsCreated { get; set; }
    public int TotalCopies { get; set; }
}
