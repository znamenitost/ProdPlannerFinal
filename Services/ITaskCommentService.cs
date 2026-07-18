using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public interface ITaskCommentService
{
    Task<TaskCommentListDto?> GetCommentsAsync(
        int taskId,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken = default);

    Task<TaskCommentDto?> AddCommentAsync(
        int taskId,
        User currentUser,
        bool isAdmin,
        AddTaskCommentRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteCommentAsync(
        int taskId,
        long commentId,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken = default);

    /// <summary>Первая запись стека при создании задачи (без оповещения).</summary>
    Task SeedInitialCommentAsync(
        ProductionTask task,
        User author,
        bool authorIsAdmin,
        CancellationToken cancellationToken = default);

    Task<string> RefreshTaskCommentPreviewAsync(int taskId, CancellationToken cancellationToken = default);

    /// <summary>Разово пересобирает превью, где у baseline ещё отображается автор.</summary>
    Task RebuildStaleBaselinePreviewsAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<int, int>> GetUnreadBadgeCountsAsync(
        IReadOnlyList<int> taskIds,
        string viewerUserId,
        CancellationToken cancellationToken = default);

    Task MarkCommentsReadAsync(
        int taskId,
        string viewerUserId,
        CancellationToken cancellationToken = default);
}
