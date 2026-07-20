using Microsoft.Extensions.Options;

namespace ProductionPlanner.Services.LabelPrint;

public static class PrintAgentAuth
{
    public const string HeaderName = "X-Print-Agent-Token";
    public const string QueryName = "access_token";

    public static bool IsAuthorized(HttpRequest request, IOptions<PrintAgentOptions> options)
    {
        var expected = (options.Value.AccessToken ?? "").Trim();
        if (string.IsNullOrEmpty(expected))
            return false;

        var provided = request.Headers[HeaderName].FirstOrDefault()
            ?? request.Query[QueryName].FirstOrDefault()
            ?? "";

        if (provided.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            provided = provided["Bearer ".Length..].Trim();

        return string.Equals(provided.Trim(), expected, StringComparison.Ordinal);
    }
}
