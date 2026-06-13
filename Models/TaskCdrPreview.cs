using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models;

[Index(nameof(UpdatedAt))]
public class TaskCdrPreview
{
    [Key]
    public int TaskId { get; set; }

    public ProductionTask Task { get; set; } = null!;

    [MaxLength(64)]
    public string ContentType { get; set; } = "image/webp";

    public byte[] Data { get; set; } = [];

    public int ByteSize { get; set; }

    [MaxLength(512)]
    public string SourceKey { get; set; } = "";

    public DateTime UpdatedAt { get; set; }
}
