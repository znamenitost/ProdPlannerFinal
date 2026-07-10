using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class ChatAttachment
{
    public long Id { get; set; }

    public long MessageId { get; set; }

    public ChatMessage Message { get; set; } = null!;

    [Required]
    [MaxLength(260)]
    public string FileName { get; set; } = "";

    [Required]
    [MaxLength(120)]
    public string ContentType { get; set; } = "application/octet-stream";

    public long SizeBytes { get; set; }

    [Required]
    [MaxLength(500)]
    public string StoragePath { get; set; } = "";

    public DateTime CreatedAt { get; set; }
}
