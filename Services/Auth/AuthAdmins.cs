namespace ProductionPlanner.Services.Auth;

using ProductionPlanner.Models;

public static class AuthAdmins
{
    public const string DefaultPassword = "2960040";

    public static readonly (string Email, string FullName)[] Accounts =
    [
        ("pavel@admin.com", "Павел"),
        ("inna@admin.com", "Инна"),
        ("lesha@admin.com", "Леша"),
        ("maxim@admin.com", "Максим"),
    ];

    public const string DeployPrepareFullName = "Павел";

    public static bool CanPrepareDeploy(User user) =>
        string.Equals(user.FullName, DeployPrepareFullName, StringComparison.Ordinal);
}
