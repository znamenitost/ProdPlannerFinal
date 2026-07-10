using ProductionPlanner.Models;

namespace ProductionPlanner.Hubs;

public static class ChatGroups
{
    public const string Team = "chat:team";

    public static string ForDirect(long conversationId) => $"chat:dm:{conversationId}";

    public static string ForConversation(ChatConversation conversation) =>
        conversation.Type == ChatConversationType.Team
            ? Team
            : ForDirect(conversation.Id);
}
