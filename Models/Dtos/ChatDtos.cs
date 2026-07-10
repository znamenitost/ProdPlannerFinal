namespace ProductionPlanner.Models.Dtos;

public sealed class ChatContactDto
{
    public string UserId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public string Role { get; set; } = "";
}

public sealed class ChatAttachmentDto
{
    public long Id { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long SizeBytes { get; set; }
    public string Url { get; set; } = "";
}

public sealed class ChatMessageDto
{
    public long Id { get; set; }
    public long ConversationId { get; set; }
    public string SenderUserId { get; set; } = "";
    public string SenderFullName { get; set; } = "";
    public string? SenderAvatarUrl { get; set; }
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    /// <summary>For the current user's own messages: "sent" or "read". Null for incoming.</summary>
    public string? Status { get; set; }
    public IReadOnlyList<ChatAttachmentDto> Attachments { get; set; } = Array.Empty<ChatAttachmentDto>();
}

public sealed class EditChatMessageRequest
{
    public string Text { get; set; } = "";
}

public sealed class ChatConversationDto
{
    public long Id { get; set; }
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string? PeerUserId { get; set; }
    public string? PeerFullName { get; set; }
    public string? PeerAvatarUrl { get; set; }
    public bool PeerIsOnline { get; set; }
    public ChatMessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
}

public sealed class SendChatMessageRequest
{
    public string Text { get; set; } = "";
}

public sealed class OpenDirectChatRequest
{
    public string UserId { get; set; } = "";
}

public sealed class MarkChatReadRequest
{
    public long LastMessageId { get; set; }
}
