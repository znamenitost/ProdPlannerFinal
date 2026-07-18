using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(ProductionTaskId), nameof(Id))]
public class TaskComment
{
    [Key]
    public long Id { get; set; }

    public int ProductionTaskId { get; set; }

    public ProductionTask ProductionTask { get; set; } = null!;

    [Required]
    [MaxLength(450)]
    public string AuthorUserId { get; set; } = "";

    [Required]
    [MaxLength(100)]
    public string AuthorName { get; set; } = "";

    /// <summary>Нужно для ACL удаления: комментарии админов удаляют только админы.</summary>
    public bool AuthorIsAdmin { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Text { get; set; } = "";

    /// <summary>null — комментарий для всех (админы + сотрудники).</summary>
    [MaxLength(450)]
    public string? RecipientUserId { get; set; }

    [MaxLength(100)]
    public string? RecipientName { get; set; }

    /// <summary>Ответ на конкретный комментарий (мини-чат).</summary>
    public long? ReplyToCommentId { get; set; }

    /// <summary>
    /// Базовый комментарий при создании задачи: без пушей и без бейджа +N.
    /// </summary>
    public bool IsBaseline { get; set; }

    public DateTime CreatedAt { get; set; }
}
