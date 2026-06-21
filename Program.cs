using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Infrastructure.Logging;
using ProductionPlanner.Models;
using ProductionPlanner.Services.MaxMessenger;
using System.Text.Json;
using System.Text.Json.Serialization;

// Moscow wall-clock DateTime values (Unspecified) in queries against timestamptz
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

if (args.Length > 0 && args[0].Equals("apply-migrations", StringComparison.OrdinalIgnoreCase))
{
    Environment.Exit(await SchemaMigrationCli.RunAsync(args));
}

if (args.Length > 0 && args[0].Equals("generate-app-offline", StringComparison.OrdinalIgnoreCase))
{
    Environment.Exit(AppOfflineCli.Run(args));
}

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsProduction())
    builder.Configuration.AddJsonFile("appsettings.Production.local.json", optional: true);

var logsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "logs");
Directory.CreateDirectory(logsDirectory);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddProvider(new FileLoggerProvider(Path.Combine(logsDirectory, "app.log")));

if (builder.Environment.IsDevelopment())
    builder.WebHost.UseUrls("http://0.0.0.0:5234", "http://localhost:5234");

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var postgresConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var usePostgres = !string.IsNullOrWhiteSpace(postgresConnection);
if (usePostgres)
{
    var postgresConnectionString = PostgresConnectionHelper.Normalize(postgresConnection!);
    builder.Services.AddDbContextPool<ApplicationDbContext>(options =>
        options
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .UseNpgsql(postgresConnectionString, npgsql =>
                npgsql.EnableRetryOnFailure(maxRetryCount: 3)));
}
else
{
    var dataDirectory = Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
    Directory.CreateDirectory(dataDirectory);
    var dbPath = Path.Combine(dataDirectory, "ProductionPlanner.db");
    builder.Services.AddDbContextPool<ApplicationDbContext>(options =>
        options
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .UseSqlite($"Data Source={dbPath}"));
}

builder.Services.AddProductionPlannerDataProtection();
builder.Services.AddIdentity<User, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 3;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.None;
    options.LoginPath = "/api/auth/login";
    options.LogoutPath = "/api/auth/logout";
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
    options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
    options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
});

builder.Services.AddAuthorization();
builder.Services.Configure<MaxBotOptions>(builder.Configuration.GetSection(MaxBotOptions.SectionName));
builder.Services.AddProductionPlannerServices();
builder.Services.AddSingleton<NotificationConnectionRegistry>();
builder.Services.AddSignalR(options =>
{
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:5173"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
startupLogger.LogInformation(
    "Старт приложения. База: {Db}. Arch: {Arch}{PgConn}",
    usePostgres ? "PostgreSQL" : "SQLite",
    System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture,
    usePostgres ? $" Conn={PostgresConnectionHelper.Mask(postgresConnection!)}" : "");

if (usePostgres && builder.Environment.IsProduction())
{
    var localOverridePath = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.Production.local.json");
    if (File.Exists(localOverridePath))
        startupLogger.LogWarning(
            "На сервере найден appsettings.Production.local.json — он перекрывает строку из деплоя. Удалите файл с FTP, если не нужен.");
}

await DatabaseInitializer.InitializeAsync(app.Services);
app.ConfigureProductionPlannerPipeline();

startupLogger.LogInformation("Приложение запущено, слушаем запросы IIS/ANCM");
app.Run();
