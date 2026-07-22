namespace ProductionPlanner.Models.Dtos;

public class TaskTableSortSettingsDto
{
    public bool DeadlineSort { get; set; }

    public bool CompletedBottomSort { get; set; } = true;

    public bool HideCompletedSort { get; set; }

    public bool HideCompletedInSharedSort { get; set; }

    /// <summary>Админ: показывать задачи «Суета» в таблице.</summary>
    public bool ShowFuss { get; set; }
}
