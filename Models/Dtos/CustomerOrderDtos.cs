namespace ProductionPlanner.Models.Dtos;

public class CustomerOrderLinkDto
{
    public string Token { get; set; } = "";
    public string Path { get; set; } = "";
    public string Url { get; set; } = "";
    public string CustomerName { get; set; } = "";
}

public class CustomerOrderPublicDto
{
    public string CustomerName { get; set; } = "";
    public List<CustomerOrderPublicItemDto> Orders { get; set; } = [];
}

public class CustomerOrderPublicItemDto
{
    public int TaskId { get; set; }
    public string Title { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public string Status { get; set; } = "";
    public string StatusKind { get; set; } = "";
}

/// <summary>Поиск по коду: заказчик и все его невыданные заказы.</summary>
public class PickupCustomerLookupDto
{
    public string CustomerName { get; set; } = "";
    public string MatchedPickupCode { get; set; } = "";
    public List<PickupCustomerOrderItemDto> Orders { get; set; } = [];
}

public class PickupCustomerOrderItemDto
{
    public int TaskId { get; set; }
    public string PickupCode { get; set; } = "";
    public string Title { get; set; } = "";
    public string Status { get; set; } = "";
    public string StatusKind { get; set; } = "";
    public bool CanIssue { get; set; }
}

public class PickupIssueResultDto
{
    public int IssuedCount { get; set; }
    public List<string> PickupCodes { get; set; } = [];
}
