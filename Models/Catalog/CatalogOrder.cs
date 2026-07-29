using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models.Catalog;

public class CatalogOrder
{
    public int Id { get; set; }

    [MaxLength(32)]
    public string PublicNumber { get; set; } = "";

    public CatalogOrderStatus Status { get; set; } = CatalogOrderStatus.New;

    [MaxLength(200)]
    public string CustomerName { get; set; } = "";

    [MaxLength(80)]
    public string? Phone { get; set; }

    [MaxLength(120)]
    public string? Telegram { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(2000)]
    public string Comment { get; set; } = "";

    public decimal TotalAmount { get; set; }

    public DateTime? DesiredDeadline { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<CatalogOrderLine> Lines { get; set; } = new();
}
