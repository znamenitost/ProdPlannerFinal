using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(UserId), nameof(AcknowledgedAt))]
public class UserNotification
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string UserId { get; set; } = "";

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "";

    public int? TaskId { get; set; }

    [Required]
    [MaxLength(500)]
    public string Title { get; set; } = "";

    public DateTime? Deadline { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? AcknowledgedAt { get; set; }
}
