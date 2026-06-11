using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProductionPlanner.Data;

namespace ProductionPlanner.Infrastructure;

/// <summary>
/// Одноразовые правки данных при деплое (apply-migrations). Идемпотентны — безопасны при повторном запуске.
/// </summary>
public static class DeployDataPatches
{
    public static async Task ApplyAsync(
        IServiceProvider serviceProvider,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (!db.Database.IsNpgsql())
            return;

        await DeleteTaskIfExistsAsync(scope.ServiceProvider, db, 152, logger, cancellationToken);
    }

    private static async Task DeleteTaskIfExistsAsync(
        IServiceProvider scopedProvider,
        ApplicationDbContext db,
        int taskId,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var exists = await db.ProductionTasks.AnyAsync(t => t.Id == taskId, cancellationToken);
        if (!exists)
        {
            logger.LogInformation("Deploy patch: задача #{TaskId} уже отсутствует, пропуск.", taskId);
            return;
        }

        var notificationsDeleted = await db.UserNotifications
            .Where(n => n.TaskId == taskId)
            .ExecuteDeleteAsync(cancellationToken);
        if (notificationsDeleted > 0)
            logger.LogInformation("Deploy patch: удалено уведомлений для задачи #{TaskId}: {Count}.", taskId, notificationsDeleted);

        var repo = scopedProvider.GetRequiredService<IProductionTaskRepository>();
        await repo.DeleteTaskAsync(taskId, cancellationToken);
        logger.LogInformation("Deploy patch: задача #{TaskId} удалена.", taskId);
    }
}
