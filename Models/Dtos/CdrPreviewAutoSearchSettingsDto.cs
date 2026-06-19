namespace ProductionPlanner.Models.Dtos;

public sealed class CdrPreviewAutoSearchSettingsDto
{
    /// <summary>Интервал в минутах до второй попытки превью (0 — автопоиск выкл.).</summary>
    public int Minutes { get; set; }
}
