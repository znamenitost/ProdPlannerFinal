namespace ProductionPlanner.Services.Auth;

public static class AuthEmployees
{
    public static readonly string[] AllowedFullNames = ["Дима", "Яромир"];

    public static bool IsAllowed(string fullName) =>
        AllowedFullNames.Contains(fullName, StringComparer.Ordinal);
}
