namespace ProductionPlanner.Models.Dtos;

public class FileOpenSettingsDto
{
    /// <summary>Имя ПК в сети для UNC / netopen (например MINIMARKER).</summary>
    public string WindowsHost { get; set; } = "MINIMARKER";

    /// <summary>Имя SMB-шары — корень клиентских файлов (например Клиенты).</summary>
    public string ShareName { get; set; } = "Клиенты";

    /// <summary>Хост для smb:// на Mac.</summary>
    public string MacSmbHost { get; set; } = "minimarker";
}
