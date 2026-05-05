using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Для локальной разработки и публикации — слушаем все адреса
builder.WebHost.UseUrls("http://0.0.0.0:5234", "http://localhost:5234");

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var dataDirectory = Path.Combine(AppContext.BaseDirectory, "App_Data");
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
builder.Services.AddScoped<ITableRowRepository, TableRowRepository>();
builder.Services.AddScoped<ISyncService, SyncService>();

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
    db.Database.EnsureCreated();

    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""TableRows"" (
            ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_TableRows"" PRIMARY KEY AUTOINCREMENT,
            ""DisplayOrder"" INTEGER NOT NULL,
            ""FolderPath"" TEXT NOT NULL,
            ""FileName"" TEXT NOT NULL,
            ""Comment"" TEXT NOT NULL,
            ""StatusText"" TEXT NOT NULL,
            ""Deadline"" TEXT NOT NULL,
            ""EstimateHours"" REAL NOT NULL,
            ""Type"" TEXT NOT NULL,
            ""EmployeeName"" TEXT NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NOT NULL,
            ""IsFromGoogleSheets"" INTEGER NOT NULL,
            ""ParentRowNumber"" INTEGER NULL
        );
    ");

    await InitializeUsersAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();  // для фронтенда из wwwroot
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

    string[] roles = { "Admin", "Employee", "Viewer" };
    foreach (var role in roles)
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));

    // Админ Павел
    var pavelUser = await userManager.FindByEmailAsync("pavel@admin.com");
    if (pavelUser == null)
    {
        pavelUser = new User
        {
            UserName = "pavel@admin.com",
            Email = "pavel@admin.com",
            FullName = "Павел",
            Role = "Admin",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(pavelUser, "Admin123!");
        await userManager.AddToRoleAsync(pavelUser, "Admin");
    }

    var dimaUser = userManager.Users.FirstOrDefault(u => u.FullName == "Дима");
    if (dimaUser == null)
    {
        dimaUser = new User
        {
            UserName = "dima@employee.local",
            Email = "dima@employee.local",
            FullName = "Дима",
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(dimaUser, "Employee123!");
        await userManager.AddToRoleAsync(dimaUser, "Employee");
    }

    var yaromerUser = userManager.Users.FirstOrDefault(u => u.FullName == "Яромир");
    if (yaromerUser == null)
    {
        yaromerUser = new User
        {
            UserName = "yaromer@employee.local",
            Email = "yaromer@employee.local",
            FullName = "Яромир",
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(yaromerUser, "Employee123!");
        await userManager.AddToRoleAsync(yaromerUser, "Employee");
    }
}