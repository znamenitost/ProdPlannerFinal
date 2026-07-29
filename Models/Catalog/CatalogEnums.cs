namespace ProductionPlanner.Models.Catalog;

public enum CatalogImageKind
{
    Photo = 0,
    Example = 1,
    Artwork = 2
}

/// <summary>Тип вкладки витрины / админ-конструктора.</summary>
public enum CatalogTabType
{
    Photo = 0,
    Colors = 1,
    Mockup = 2
}

public enum CatalogOrderStatus
{
    New = 0,
    Confirmed = 1,
    Cancelled = 2
}
