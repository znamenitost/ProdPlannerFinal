using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Однократный перенос данных из локальной SQLite в PostgreSQL (1gb.ru и др.).
/// </summary>
public static class SqliteToPostgresMigrator
{
    public static async Task<int> RunAsync(string sqlitePath, string postgresConnection, bool clearTarget, ILogger? logger = null)
    {
        if (!File.Exists(sqlitePath))
            throw new FileNotFoundException($"SQLite не найден: {sqlitePath}");

        var sqliteOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={sqlitePath}")
            .Options;
        var pgOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(postgresConnection, b => b.EnableRetryOnFailure(maxRetryCount: 3))
            .Options;

        await using var source = new ApplicationDbContext(sqliteOptions);
        await using var target = new ApplicationDbContext(pgOptions);

        try
        {
            await target.Database.OpenConnectionAsync();
            await target.Database.CloseConnectionAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Не удалось подключиться к PostgreSQL: {ex.Message}", ex);
        }

        await target.Database.MigrateAsync();
        logger?.LogInformation("Схема PostgreSQL готова.");

        if (clearTarget)
            await ClearPostgresDataAsync(target, logger);

        var taskCount = await CopyTableAsync(source.ProductionTasks.AsNoTracking(), target.ProductionTasks, target, logger, "ProductionTasks");
        var intervalCount = await CopyTableAsync(source.WorkIntervals.AsNoTracking(), target.WorkIntervals, target, logger, "WorkIntervals");
        var statCount = await CopyTableAsync(source.EmployeeStats.AsNoTracking(), target.EmployeeStats, target, logger, "EmployeeStats");
        var splitCount = await CopyTableAsync(source.TaskSplits.AsNoTracking(), target.TaskSplits, target, logger, "TaskSplits");
        var notificationCount = await CopyTableAsync(
            source.UserNotifications.AsNoTracking(),
            target.UserNotifications,
            target,
            logger,
            "UserNotifications");

        await CopyIdentityAsync(source, target, logger);
        await ResetPostgresSequencesAsync(target, logger);

        logger?.LogInformation(
            "Перенос завершён: задач {Tasks}, интервалов {Intervals}, статистика {Stats}, сплиты {Splits}, уведомления {Notifications}",
            taskCount, intervalCount, statCount, splitCount, notificationCount);

        return taskCount;
    }

    private static async Task<int> CopyTableAsync<T>(
        IQueryable<T> sourceQuery,
        DbSet<T> targetSet,
        ApplicationDbContext target,
        ILogger? logger,
        string name) where T : class
    {
        var rows = await sourceQuery.ToListAsync();
        if (rows.Count == 0)
        {
            logger?.LogInformation("{Table}: нет данных", name);
            return 0;
        }

        await targetSet.AddRangeAsync(rows);
        await target.SaveChangesAsync();
        target.ChangeTracker.Clear();
        logger?.LogInformation("{Table}: скопировано {Count} строк", name, rows.Count);
        return rows.Count;
    }

    private static async Task CopyIdentityAsync(
        ApplicationDbContext source,
        ApplicationDbContext target,
        ILogger? logger)
    {
        var roles = await source.Roles.AsNoTracking().ToListAsync();
        if (roles.Count > 0)
        {
            await target.Roles.AddRangeAsync(roles);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        var users = await source.Users.AsNoTracking().ToListAsync();
        if (users.Count > 0)
        {
            await target.Users.AddRangeAsync(users);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        var userRoles = await source.UserRoles.AsNoTracking().ToListAsync();
        if (userRoles.Count > 0)
        {
            await target.Set<Microsoft.AspNetCore.Identity.IdentityUserRole<string>>().AddRangeAsync(userRoles);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        var claims = await source.UserClaims.AsNoTracking().ToListAsync();
        if (claims.Count > 0)
        {
            await target.UserClaims.AddRangeAsync(claims);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        var logins = await source.UserLogins.AsNoTracking().ToListAsync();
        if (logins.Count > 0)
        {
            await target.UserLogins.AddRangeAsync(logins);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        var tokens = await source.UserTokens.AsNoTracking().ToListAsync();
        if (tokens.Count > 0)
        {
            await target.UserTokens.AddRangeAsync(tokens);
            await target.SaveChangesAsync();
            target.ChangeTracker.Clear();
        }

        logger?.LogInformation("Identity: ролей {Roles}, пользователей {Users}", roles.Count, users.Count);
    }

    private static async Task ClearPostgresDataAsync(ApplicationDbContext db, ILogger? logger)
    {
        logger?.LogWarning("Очистка целевых таблиц PostgreSQL перед переносом…");

        await db.Database.ExecuteSqlRawAsync("""
            TRUNCATE TABLE
                "UserNotifications",
                "WorkIntervals",
                "TaskSplits",
                "ProductionTasks",
                "EmployeeStats",
                "UserTokens",
                "UserLogins",
                "UserClaims",
                "UserRoles",
                "Users",
                "Roles"
            RESTART IDENTITY CASCADE;
            """);

        db.ChangeTracker.Clear();
    }

    private static async Task ResetPostgresSequencesAsync(ApplicationDbContext db, ILogger? logger)
    {
        await db.Database.ExecuteSqlRawAsync("""
            SELECT setval(pg_get_serial_sequence('"ProductionTasks"', 'Id'),
                COALESCE((SELECT MAX("Id") FROM "ProductionTasks"), 1));
            SELECT setval(pg_get_serial_sequence('"WorkIntervals"', 'Id'),
                COALESCE((SELECT MAX("Id") FROM "WorkIntervals"), 1));
            SELECT setval(pg_get_serial_sequence('"EmployeeStats"', 'Id'),
                COALESCE((SELECT MAX("Id") FROM "EmployeeStats"), 1));
            SELECT setval(pg_get_serial_sequence('"TaskSplits"', 'Id'),
                COALESCE((SELECT MAX("Id") FROM "TaskSplits"), 1));
            SELECT setval(pg_get_serial_sequence('"UserNotifications"', 'Id'),
                COALESCE((SELECT MAX("Id") FROM "UserNotifications"), 1));
            """);

        logger?.LogInformation("Последовательности PostgreSQL синхронизированы.");
    }
}
