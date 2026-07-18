namespace ProductionPlanner.Models.Dtos;

public sealed class TaskCommentReplyPreviewDto
{
    public long Id { get; set; }
    public string AuthorName { get; set; } = "";
    public string Preview { get; set; } = "";
}

public sealed class TaskCommentDto
{
    public long Id { get; set; }
    public int TaskId { get; set; }
    public string AuthorUserId { get; set; } = "";
    public string AuthorName { get; set; } = "";
    public string Text { get; set; } = "";
    public string? RecipientUserId { get; set; }
    public string? RecipientName { get; set; }
    public long? ReplyToCommentId { get; set; }
    public TaskCommentReplyPreviewDto? ReplyTo { get; set; }
    public bool CanDelete { get; set; }
    /// <summary>Базовый комментарий при создании задачи — автора в UI не показываем.</summary>
    public bool IsBaseline { get; set; }
}

public sealed class AddTaskCommentRequest
{
    public string Text { get; set; } = "";
    public string? RecipientUserId { get; set; }
    public long? ReplyToCommentId { get; set; }
}

public sealed class TaskCommentListDto
{
    public IReadOnlyList<TaskCommentDto> Comments { get; set; } = Array.Empty<TaskCommentDto>();
    public string Preview { get; set; } = "";
}
