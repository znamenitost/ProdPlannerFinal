using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models;

public class ChatMessage
{
    public long Id { get; set; }

    public long ConversationId { get; set; }

    public ChatConversation Conversation { get; set; } = null!;

    [Required]
    [MaxLength(450)]
    public string SenderUserId { get; set; } = "";

    [Required]
    [MaxLength(4000)]
    public string Text { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    public ICollection<ChatAttachment> Attachments { get; set; } = new List<ChatAttachment>();
}
