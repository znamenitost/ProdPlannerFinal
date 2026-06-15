namespace ProductionPlanner.Models.Dtos;

public class TaskTableSortSettingsDto
{
    public bool DeadlineSort { get; set; }

    public bool CompletedBottomSort { get; set; } = true;

    public bool HideCompletedSort { get; set; }
}
