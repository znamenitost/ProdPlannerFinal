namespace ProductionPlanner.Models.Dtos;

public sealed class CdrPreviewRetryItemDto
{
    public int TaskId { get; set; }

    public string FolderPath { get; set; } = "";

    public string FileName { get; set; } = "";
}
