using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class MaxLinkToken
{
    [Key]
    [MaxLength(32)]
    public string Code { get; set; } = "";

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = "";

    public DateTime ExpiresAt { get; set; }
}
