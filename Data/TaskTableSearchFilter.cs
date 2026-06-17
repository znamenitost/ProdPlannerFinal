using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models;

namespace ProductionPlanner.Data;

/// <summary>
/// Фильтр строк таблицы по пути и имени файла (как на фронте: folderPath, fileName).
/// Достаточно совпадения любого слова запроса; для split-родителя учитываются и дочерние задачи.
/// </summary>
internal static class TaskTableSearchFilter
{
    public static IQueryable<ProductionTask> ApplyToRootTasks(
        this IQueryable<ProductionTask> roots,
        ApplicationDbContext context,
        string? search)
    {
        var trimmed = search?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return roots;

        var terms = trimmed
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.ToLowerInvariant())
            .Distinct()
            .ToArray();

        if (terms.Length == 0)
            return roots;

        var parentsWithMatchingChild = context.TaskSplits
            .AsNoTracking()
            .Join(
                context.ProductionTasks.AsNoTracking(),
                s => s.ChildTaskId,
                child => child.Id,
                (s, child) => new { s.ParentRowNumber, child.FolderPath, child.FileName })
            .Where(x => terms.Any(term =>
                x.FolderPath.ToLower().Contains(term)
                || x.FileName.ToLower().Contains(term)))
            .Select(x => x.ParentRowNumber);

        return roots.Where(t =>
            terms.Any(term =>
                t.FolderPath.ToLower().Contains(term)
                || t.FileName.ToLower().Contains(term))
            || parentsWithMatchingChild.Contains(t.Id));
    }
}
