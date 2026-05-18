namespace ProductionPlanner.Models.Dtos;

public class NotificationDto
{
    public long Id { get; set; }
    public string Type { get; set; } = "";
    public int? TaskId { get; set; }
    public string Title { get; set; } = "";
    public DateTime? Deadline { get; set; }
    public DateTime CreatedAt { get; set; }
}
