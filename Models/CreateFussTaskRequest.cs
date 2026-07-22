using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class CreateFussTaskRequest
{
    [Required(AllowEmptyStrings = false)]
    [MinLength(1)]
    public string Comment { get; set; } = "";
}
