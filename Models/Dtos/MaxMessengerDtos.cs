namespace ProductionPlanner.Models.Dtos;

public sealed class MaxLinkStatusDto
{
    public bool Linked { get; set; }
    public bool BotConfigured { get; set; }
    public string? BotUsername { get; set; }
    public DateTime? LinkedAt { get; set; }
}

public sealed class MaxLinkTokenDto
{
    public string Code { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public string Instruction { get; set; } = "";
}

public sealed class TaskMaxSubscriptionDto
{
    public int TaskId { get; set; }
    public bool Subscribed { get; set; }
}

public sealed class MaxSubscriptionIdsDto
{
    public int[] TaskIds { get; set; } = [];
}
