using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(UserId), nameof(ProductionTaskId), IsUnique = true)]
public class TaskCommentReadState
{
    [Key]
    public long Id { get; set; }

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = "";

    public int ProductionTaskId { get; set; }

    public long LastReadCommentId { get; set; }

    public DateTime UpdatedAt { get; set; }
}
