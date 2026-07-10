namespace ProductionPlanner.Models;

public class ChatConversation
{
    public long Id { get; set; }

    public ChatConversationType Type { get; set; }

    /// <summary>For Direct: lexicographically smaller user id.</summary>
    public string? UserIdLow { get; set; }

    /// <summary>For Direct: lexicographically larger user id.</summary>
    public string? UserIdHigh { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
