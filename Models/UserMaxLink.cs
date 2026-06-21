using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(MaxUserId))]
public class UserMaxLink
{
    [Key]
    [MaxLength(450)]
    public string UserId { get; set; } = "";

    public User? User { get; set; }

    public long MaxUserId { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime LinkedAt { get; set; }
}
