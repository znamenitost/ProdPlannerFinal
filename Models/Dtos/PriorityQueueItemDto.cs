namespace ProductionPlanner.Models.Dtos;

public class PriorityQueueItemDto
{
    public int Rank { get; set; }
    public int TaskId { get; set; }
    public string Label { get; set; } = "";
}
