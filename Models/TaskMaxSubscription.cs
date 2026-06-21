using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(UserId), nameof(TaskId), IsUnique = true)]
[Index(nameof(TaskId))]
public class TaskMaxSubscription
{
    [Key]
    public long Id { get; set; }

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = "";

    public int TaskId { get; set; }

    public DateTime CreatedAt { get; set; }
}
