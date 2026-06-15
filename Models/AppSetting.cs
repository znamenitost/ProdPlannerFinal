using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class AppSetting
{
    [Key]
    [MaxLength(128)]
    public string Key { get; set; } = "";

    public string Json { get; set; } = "{}";

    public DateTime UpdatedAt { get; set; }
}
