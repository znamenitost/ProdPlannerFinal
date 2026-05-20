using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Локально — порт 5234. На IIS (1gb) порт задаёт ANCM через ASPNETCORE_PORT — UseUrls не переопределяем.
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
builder.Services.AddLogging();

var postgresConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var usePostgres = !string.IsNullOrWhiteSpace(postgresConnection);
if (usePostgres)
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(postgresConnection, npgsql =>
            npgsql.EnableRetryOnFailure(maxRetryCount: 3)));
}
else
{
    var dataDirectory = Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
    Directory.CreateDirectory(dataDirectory);
    var dbPath = Path.Combine(dataDirectory, "ProductionPlanner.db");
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlite($"Data Source={dbPath}"));
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
    usePostgres ? "База данных: PostgreSQL" : "База данных: SQLite (App_Data/ProductionPlanner.db)");

await DatabaseInitializer.InitializeAsync(app.Services);
app.ConfigureProductionPlannerPipeline();
app.Run();
