using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

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

// --- SQLite ---
var dataDirectory = Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
Directory.CreateDirectory(dataDirectory);
var dbPath = Path.Combine(dataDirectory, "ProductionPlanner.db");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

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

builder.Services.AddScoped<IWorkHoursCalculator, WorkHoursCalculator>();
builder.Services.AddScoped<IProductionScheduler, ProductionScheduler>();
builder.Services.AddScoped<ITaskLifecycleService, TaskLifecycleService>();
builder.Services.AddScoped<IEmployeeStatsService, EmployeeStatsService>();
builder.Services.AddScoped<IProductionTaskRepository, ProductionTaskRepository>();
builder.Services.AddScoped<ITaskSplitService, TaskSplitService>();
builder.Services.AddScoped<IAppTimeService, AppTimeService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Создаём БД, если её нет (для SQLite – файл .db)
    var created = db.Database.EnsureCreated();
    logger.LogInformation(created ? "База данных создана." : "База данных уже существует.");

    // Автоматическое добавление недостающих колонок (безопасно для SQLite)
    try
    {
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info(ProductionTasks)";
            using var reader = await cmd.ExecuteReaderAsync();
            var columns = new HashSet<string>();
            while (await reader.ReadAsync())
                columns.Add(reader.GetString(1));

            var alterCommands = new List<string>();
            if (!columns.Contains("FolderPath"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN FolderPath TEXT NOT NULL DEFAULT ''");
            if (!columns.Contains("FileName"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN FileName TEXT NOT NULL DEFAULT ''");
            if (!columns.Contains("DisplayOrder"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN DisplayOrder INTEGER NOT NULL DEFAULT 0");
            if (!columns.Contains("CreatedAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN CreatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'");
            if (!columns.Contains("UpdatedAt"))
                alterCommands.Add("ALTER TABLE ProductionTasks ADD COLUMN UpdatedAt TEXT NOT NULL DEFAULT '2024-01-01 00:00:00'");

            foreach (var alterCmd in alterCommands)
            {
                using var alterCommand = connection.CreateCommand();
                alterCommand.CommandText = alterCmd;
                await alterCommand.ExecuteNonQueryAsync();
                logger.LogInformation($"Выполнен ALTER: {alterCmd}");
            }
        }
        await connection.CloseAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Ошибка при обновлении схемы БД");
    }

    await InitializeUsersAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseCors("AllowReact");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

async Task InitializeUsersAsync(IServiceProvider serviceProvider)
{
    var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = serviceProvider.GetRequiredService<UserManager<User>>();
    var logger = serviceProvider.GetRequiredService<ILogger<Program>>();

    string[] roles = { "Admin", "Employee", "Viewer" };
    foreach (var role in roles)
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));

    if (await userManager.FindByEmailAsync("pavel@admin.com") == null)
    {
        var user = new User
        {
            UserName = "pavel@admin.com",
            Email = "pavel@admin.com",
            FullName = "Павел",
            Role = "Admin",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(user, "Admin123!");
        await userManager.AddToRoleAsync(user, "Admin");
        logger.LogInformation("Создан администратор Павел");
    }

    if (await userManager.FindByNameAsync("dima@employee.local") == null)
    {
        var user = new User
        {
            UserName = "dima@employee.local",
            Email = "dima@employee.local",
            FullName = "Дима",
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(user, "Employee123!");
        await userManager.AddToRoleAsync(user, "Employee");
        logger.LogInformation("Создан сотрудник Дима");
    }

    if (await userManager.FindByNameAsync("yaromer@employee.local") == null)
    {
        var user = new User
        {
            UserName = "yaromer@employee.local",
            Email = "yaromer@employee.local",
            FullName = "Яромир",
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(user, "Employee123!");
        await userManager.AddToRoleAsync(user, "Employee");
        logger.LogInformation("Создан сотрудник Яромир");
    }
}