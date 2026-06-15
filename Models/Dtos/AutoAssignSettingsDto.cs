namespace ProductionPlanner.Models.Dtos;

public class AutoAssignSettingsDto
{
    public bool Enabled { get; set; }

    public Dictionary<string, List<string>>? TypeRules { get; set; }
}
