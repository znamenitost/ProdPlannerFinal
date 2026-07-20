namespace ProductionPlanner.Models.Dtos;

public class PrintJobDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string OrderTitle { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
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
    public string PickupCode { get; set; } = "";
    public string? ErrorMessage { get; set; }
}
