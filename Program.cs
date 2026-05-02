using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Настройка SQLite с папкой App_Data (для прав на запись на хостинге)
var dataDirectory = Path.Combine(AppContext.BaseDirectory, "App_Data");
Directory.CreateDirectory(dataDirectory);
var dbPath = Path.Combine(dataDirectory, "ProductionPlanner.db");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Добавляем Identity
builder.Services.AddIdentity<User, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Настройка паролей (упрощённая для тестирования)
builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 3;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
});

// Настройка Cookie для аутентификации
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.None; // Для разработки (http)
    options.LoginPath = "/api/auth/login";
    options.LogoutPath = "/api/auth/logout";
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

// Добавляем аутентификацию
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
    options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
    options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
});

builder.Services.AddAuthorization();

// Регистрация сервисов (Google Sheets удалён)
builder.Services.AddScoped<IWorkHoursCalculator, WorkHoursCalculator>();
builder.Services.AddScoped<IProductionScheduler, ProductionScheduler>();
builder.Services.AddScoped<ITaskLifecycleService, TaskLifecycleService>();
builder.Services.AddScoped<IEmployeeStatsService, EmployeeStatsService>();
builder.Services.AddScoped<IProductionTaskRepository, ProductionTaskRepository>();
builder.Services.AddScoped<ITaskSplitService, TaskSplitService>();
builder.Services.AddScoped<ITableRowRepository, TableRowRepository>();
builder.Services.AddScoped<ISyncService, SyncService>();

// CORS для разработки (не мешает на продакшене)
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
    
    // Создаём таблицу TableRows, если её нет (с полем ParentRowNumber)
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
    
    // Создаём роли и пользователей
    await InitializeUsersAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Порядок middleware важен!
app.UseStaticFiles();           // Отдаём статику (фронтенд из wwwroot)
app.UseCors("AllowReact");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();           // API-контроллеры
app.MapFallbackToFile("index.html"); // SPA fallback — для React-роутинга

app.Run();

// Функция для инициализации пользователей
async Task InitializeUsersAsync(IServiceProvider serviceProvider)
{
    var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = serviceProvider.GetRequiredService<UserManager<User>>();
    
    // Создаём роли
    string[] roles = { "Admin", "Employee", "Viewer" };
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }
    
    // 1. Администратор Павел
    var pavelEmail = "pavel@admin.com";
    var pavelUser = await userManager.FindByEmailAsync(pavelEmail);
    if (pavelUser == null)
    {
        pavelUser = new User
        {
            UserName = pavelEmail,
            Email = pavelEmail,
            FullName = "Павел",
            Role = "Admin",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(pavelUser, "Admin123!");
        await userManager.AddToRoleAsync(pavelUser, "Admin");
        Console.WriteLine("Администратор Павел создан");
    }
    
    // 2. Сотрудник Дима (вход без пароля)
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
        Console.WriteLine("Сотрудник Дима создан");
    }
    
    // 3. Сотрудник Яромир (вход без пароля)
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
        Console.WriteLine("Сотрудник Яромир создан");
    }
    
    // 4. Дополнительный администратор (на всякий случай)
    var adminEmail = "admin@example.com";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);
    if (adminUser == null)
    {
        adminUser = new User
        {
            UserName = adminEmail,
            Email = adminEmail,
            FullName = "Администратор",
            Role = "Admin",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await userManager.CreateAsync(adminUser, "Admin123!");
        await userManager.AddToRoleAsync(adminUser, "Admin");
        Console.WriteLine("Дополнительный администратор создан");
    }
}