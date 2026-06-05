using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProductionPlanner.Services.Auth;

public class LoginEmployeesBootstrapService : ILoginEmployeesBootstrapService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IWebHostEnvironment _environment;
    private string _bootstrapJson = "[]";

    public LoginEmployeesBootstrapService(
        IServiceScopeFactory scopeFactory,
        IWebHostEnvironment environment)
    {
        _scopeFactory = scopeFactory;
        _environment = environment;
    }

    public string GetBootstrapJson() => _bootstrapJson;

    public async Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var authSession = scope.ServiceProvider.GetRequiredService<IAuthSessionService>();
        authSession.InvalidateLoginEmployeesCache();

        var employees = await authSession.GetLoginEmployeesAsync();
        _bootstrapJson = JsonSerializer.Serialize(employees, JsonOptions);

        var webRoot = _environment.WebRootPath
            ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        Directory.CreateDirectory(webRoot);

        var jsonPath = Path.Combine(webRoot, "login-employees.json");
        await File.WriteAllTextAsync(jsonPath, _bootstrapJson, cancellationToken);
    }
}
