namespace ProductionPlanner.Models.Dtos;

public sealed class WebPushConfigDto
{
    public string PublicKey { get; set; } = "";
}

public sealed class PushSubscribeRequest
{
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}

public sealed class PushUnsubscribeRequest
{
    public string Endpoint { get; set; } = "";
}
