namespace ProductionPlanner.Services.LabelPrint;

public class PrintAgentOptions
{
    public const string SectionName = "PrintAgent";

    /// <summary>Общий секрет агента (query access_token / заголовок X-Print-Agent-Token).</summary>
    public string AccessToken { get; set; } = "";
}
