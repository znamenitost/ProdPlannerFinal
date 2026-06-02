using System.Data;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Одноразовая миграция: разрезать старые WorkInterval по границам LunchInterval
/// (до модели «обед = пауза»). Идемпотентна по таблице __DataMigrations.
/// </summary>
public static class LunchWorkIntervalMigrator
{
    public const string MigrationName = "SplitWorkIntervalsAtLunch_20260602";

    private static readonly WorkHoursCalculator WorkHours = new();

    public static async Task ApplyAsync(
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsNpgsql())
        {
            logger.LogInformation("LunchWorkIntervalMigrator: пропуск (не PostgreSQL).");
            return;
        }

        await EnsureDataMigrationsTableAsync(db, cancellationToken);
        if (await IsAppliedAsync(db, cancellationToken))
        {
            logger.LogInformation("Data migration {Name} уже применена.", MigrationName);
            return;
        }

        var lunches = await db.LunchIntervals
            .AsNoTracking()
            .Where(l => l.EndTime != null)
            .OrderBy(l => l.EmployeeName)
            .ThenBy(l => l.StartTime)
            .ToListAsync(cancellationToken);

        if (lunches.Count == 0)
        {
            await MarkAppliedAsync(db, cancellationToken);
            logger.LogInformation("Data migration {Name}: обедов в БД нет, отметка применена.", MigrationName);
            return;
        }

        var splits = 0;
        var removed = 0;
        var affectedTaskIds = new HashSet<int>();

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var lunch in lunches)
            {
                var lunchStart = lunch.StartTime;
                var lunchEnd = lunch.EndTime!.Value;

                var workIntervals = await db.WorkIntervals
                    .Include(wi => wi.Task)
                    .Where(wi => wi.Task.EmployeeName == lunch.EmployeeName
                                  && wi.StartTime < lunchEnd
                                  && (wi.EndTime == null || wi.EndTime > lunchStart))
                    .ToListAsync(cancellationToken);

                foreach (var wi in workIntervals)
                {
                    if (!Overlaps(wi, lunchStart, lunchEnd))
                        continue;

                    var changed = SplitWorkIntervalAtLunch(db, wi, lunchStart, lunchEnd, out var tailAdded, out var deleted);
                    if (!changed)
                        continue;

                    if (deleted)
                        removed++;
                    else
                        splits++;
                    if (tailAdded)
                        splits++;
                    affectedTaskIds.Add(wi.ProductionTaskId);
                }
            }

            await db.SaveChangesAsync(cancellationToken);

            var completedUpdated = 0;
            foreach (var taskId in affectedTaskIds)
            {
                var task = await db.ProductionTasks
                    .Include(t => t.WorkIntervals)
                    .FirstOrDefaultAsync(
                        t => t.Id == taskId && t.Status == JobStatus.Completed,
                        cancellationToken);
                if (task == null)
                    continue;

                var actualHours = task.WorkIntervals
                    .Where(i => i.EndTime.HasValue)
                    .Sum(i => WorkHours.GetWorkHoursBetween(
                        AppDateTime.ToMoscowWallClockFromDb(i.StartTime),
                        AppDateTime.ToMoscowWallClockFromDb(i.EndTime!.Value)));

                task.ActualHours = Math.Round(actualHours, 2);
                completedUpdated++;
            }

            await db.SaveChangesAsync(cancellationToken);
            await MarkAppliedAsync(db, cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            logger.LogInformation(
                "Data migration {Name}: разрезов/добавлений {Splits}, удалено внутри обеда {Removed}, пересчитано завершённых задач {Completed}.",
                MigrationName, splits, removed, completedUpdated);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static bool Overlaps(WorkInterval wi, DateTime lunchStart, DateTime lunchEnd)
    {
        var end = wi.EndTime ?? lunchEnd;
        return wi.StartTime < lunchEnd && end > lunchStart;
    }

    private static bool SplitWorkIntervalAtLunch(
        ApplicationDbContext db,
        WorkInterval wi,
        DateTime lunchStart,
        DateTime lunchEnd,
        out bool tailAdded,
        out bool deleted)
    {
        tailAdded = false;
        deleted = false;
        var origEnd = wi.EndTime;

        if (wi.StartTime >= lunchEnd)
            return false;

        if (origEnd.HasValue && origEnd.Value <= lunchStart)
            return false;

        if (wi.StartTime < lunchStart)
        {
            if (!origEnd.HasValue || origEnd.Value > lunchEnd)
            {
                db.WorkIntervals.Add(new WorkInterval
                {
                    ProductionTaskId = wi.ProductionTaskId,
                    StartTime = lunchEnd,
                    EndTime = origEnd
                });
                wi.EndTime = lunchStart;
                tailAdded = true;
                return true;
            }

            wi.EndTime = lunchStart;
            return true;
        }

        if (!origEnd.HasValue || origEnd.Value > lunchEnd)
        {
            wi.StartTime = lunchEnd;
            return true;
        }

        db.WorkIntervals.Remove(wi);
        deleted = true;
        return true;
    }

    private static async Task EnsureDataMigrationsTableAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "__DataMigrations" (
                "Name" character varying(200) NOT NULL PRIMARY KEY,
                "AppliedAt" timestamp with time zone NOT NULL
            );
            """, cancellationToken);
    }

    private static async Task<bool> IsAppliedAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(cancellationToken);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """SELECT COUNT(*) FROM "__DataMigrations" WHERE "Name" = @name""";
        var param = cmd.CreateParameter();
        param.ParameterName = "@name";
        param.Value = MigrationName;
        cmd.Parameters.Add(param);
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken));
        return count > 0;
    }

    private static async Task MarkAppliedAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO "__DataMigrations" ("Name", "AppliedAt")
            VALUES ({0}, NOW())
            ON CONFLICT ("Name") DO NOTHING;
            """,
            MigrationName);
    }
}
