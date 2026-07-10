using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class ChatReadState
{
    public long Id { get; set; }

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = "";

    public long ConversationId { get; set; }

    public ChatConversation Conversation { get; set; } = null!;

    public long LastReadMessageId { get; set; }

    public DateTime UpdatedAt { get; set; }
}
