namespace ProductionPlanner.Models.Dtos;

public class TaskLifecycleResultDto
{
    public string Message { get; set; } = "";
    public TaskTableRowDto? Row { get; set; }
    public bool RemovedFromTable { get; set; }
    public int? ParentRowId { get; set; }
    public TaskTableRowDto? ParentRow { get; set; }
    public bool ParentRemovedFromTable { get; set; }
}
