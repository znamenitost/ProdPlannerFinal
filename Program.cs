using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Infrastructure.Logging;
using ProductionPlanner.Models;
using System.Text.Json.Serialization;

// Moscow wall-clock DateTime values (Unspecified) in queries against timestamptz
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

StartupDiagnostics.LogEnvironment();

if (args.Length > 0 && args[0].Equals("migrate-sqlite-to-postgres", StringComparison.OrdinalIgnoreCase))
{
    Environment.Exit(await MigrationCli.RunAsync(args));
}

try
{
    var builder = WebApplication.CreateBuilder(args);
    // Локальные секреты 1gb — только в Production, чтобы Development оставался на SQLite
    if (builder.Environment.IsProduction())
        builder.Configuration.AddJsonFile("appsettings.Production.local.json", optional: true);

    Directory.CreateDirectory(StartupDiagnostics.LogsDirectory);
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole();
    builder.Logging.AddProvider(
        new FileLoggerProvider(Path.Combine(StartupDiagnostics.LogsDirectory, "app.log")));
    if (OperatingSystem.IsWindows() && !builder.Environment.IsDevelopment())
    {
        builder.Logging.AddEventLog(settings =>
        {
            settings.SourceName = "ProductionPlanner";
            settings.LogName = "Application";
        });
    }

    if (builder.Environment.IsDevelopment())
        builder.WebHost.UseUrls("http://0.0.0.0:5234", "http://localhost:5234");

    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    var postgresConnection = builder.Configuration.GetConnectionString("DefaultConnection");
    var usePostgres = !string.IsNullOrWhiteSpace(postgresConnection);
    if (usePostgres)
    {
        postgresConnection = PostgresConnectionHelper.Normalize(postgresConnection);
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options
                .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
                .UseNpgsql(postgresConnection, npgsql =>
                    npgsql.EnableRetryOnFailure(maxRetryCount: 3)));
    }
    else
    {
        var dataDirectory = Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
        Directory.CreateDirectory(dataDirectory);
        var dbPath = Path.Combine(dataDirectory, "ProductionPlanner.db");
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options
                .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
                .UseSqlite($"Data Source={dbPath}"));
    }

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
    builder.Services.AddProductionPlannerServices();
    builder.Services.AddSignalR();

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
        "Старт приложения. База: {Db}. Arch: {Arch}",
        usePostgres ? "PostgreSQL" : "SQLite",
        System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture);

    await DatabaseInitializer.InitializeAsync(app.Services);
    app.ConfigureProductionPlannerPipeline();

    startupLogger.LogInformation("Приложение запущено, слушаем запросы IIS/ANCM");
    app.Run();
}
catch (Exception ex)
{
    StartupDiagnostics.Write("Критическая ошибка при запуске", ex);
    throw;
}
