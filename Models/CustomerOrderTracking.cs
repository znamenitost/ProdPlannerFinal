using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

/// <summary>
/// Публичная страница отслеживания заказов одного заказчика (последняя папка в FolderPath).
/// </summary>
public class CustomerOrderTracking
{
    [Key]
    public int Id { get; set; }

    /// <summary>Нормализованный ключ (lowercase последней папки).</summary>
    [Required]
    [MaxLength(200)]
    public string CustomerKey { get; set; } = "";

    /// <summary>Отображаемое имя заказчика.</summary>
    [Required]
    [MaxLength(200)]
    public string CustomerDisplayName { get; set; } = "";

    /// <summary>Непрозрачный токен в URL /t/{token}.</summary>
    [Required]
    [MaxLength(64)]
    public string PublicToken { get; set; } = "";

    public DateTime CreatedAt { get; set; }
}
