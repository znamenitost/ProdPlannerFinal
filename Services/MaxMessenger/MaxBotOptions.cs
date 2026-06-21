namespace ProductionPlanner.Services.MaxMessenger;

public sealed class MaxBotOptions
{
    public const string SectionName = "MaxBot";

    /// <summary>Токен бота из MAX: Чат-боты → Расширенные настройки.</summary>
    public string AccessToken { get; set; } = "";

    /// <summary>Секрет webhook (POST /subscriptions), проверяется в X-Max-Bot-Api-Secret.</summary>
    public string WebhookSecret { get; set; } = "";

    /// <summary>Имя бота (@username) для подсказки пользователю.</summary>
    public string BotUsername { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(AccessToken);
}
