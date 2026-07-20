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
    public string Title { get; set; } = "";
    public string PickupCode { get; set; } = "";
    public string Status { get; set; } = "";
    public string StatusKind { get; set; } = "";
}
