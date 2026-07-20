using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public sealed class TaskCommentService : ITaskCommentService
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<User> _userManager;
    private readonly IAppTimeService _timeService;
    private readonly ITaskNotificationService _notificationService;
    private readonly IProductionTaskRepository _repo;

    public TaskCommentService(
        ApplicationDbContext context,
        UserManager<User> userManager,
        IAppTimeService timeService,
        ITaskNotificationService notificationService,
        IProductionTaskRepository repo)
    {
        _context = context;
        _userManager = userManager;
        _timeService = timeService;
        _notificationService = notificationService;
        _repo = repo;
    }

    public async Task<TaskCommentListDto?> GetCommentsAsync(
        int taskId,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken = default)
    {
        if (!await CanAccessTaskAsync(taskId, currentUser, isAdmin, cancellationToken))
            return null;

        var comments = await LoadCommentDtosAsync(taskId, currentUser.Id, isAdmin, cancellationToken);
        await MarkCommentsReadAsync(taskId, currentUser.Id, cancellationToken);
        return new TaskCommentListDto
        {
            Comments = comments,
            Preview = FormatPreview(comments)
        };
    }

    public async Task<TaskCommentDto?> AddCommentAsync(
        int taskId,
        User currentUser,
        bool isAdmin,
        AddTaskCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        var text = (request.Text ?? "").Trim();
        if (string.IsNullOrEmpty(text))
            throw new InvalidOperationException("Текст комментария пуст");

        if (text.Length > 4000)
            throw new InvalidOperationException("Комментарий слишком длинный");

        var task = await _context.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null)
            return null;

        if (!await CanAccessTaskAsync(task, currentUser, isAdmin, cancellationToken))
            return null;

        var recipientIds = ResolveRecipientUserIds(request);
        var recipients = new List<(string UserId, string FullName)>();
        foreach (var recipientId in recipientIds)
        {
            var recipient = await _userManager.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == recipientId && u.IsActive, cancellationToken);
            if (recipient == null)
                throw new InvalidOperationException("Получатель не найден");

            recipients.Add((recipient.Id, recipient.FullName));
        }

        long? replyToId = null;
        if (request.ReplyToCommentId is > 0)
        {
            var replyParent = await _context.TaskComments
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.Id == request.ReplyToCommentId && c.ProductionTaskId == taskId,
                    cancellationToken);
            if (replyParent == null)
                throw new InvalidOperationException("Комментарий для ответа не найден");
            replyToId = replyParent.Id;
        }

        var authorName = string.IsNullOrWhiteSpace(currentUser.FullName)
            ? currentUser.UserName ?? "Пользователь"
            : currentUser.FullName.Trim();
        var now = _timeService.Now;

        // Пустой список — один комментарий без адресата и без оповещений.
        var targets = recipients.Count == 0
            ? new List<(string? UserId, string? FullName)> { (null, null) }
            : recipients.Select(r => ((string?)r.UserId, (string?)r.FullName)).ToList();

        TaskComment? lastEntity = null;
        foreach (var (recipientUserId, recipientName) in targets)
        {
            var entity = new TaskComment
            {
                ProductionTaskId = taskId,
                AuthorUserId = currentUser.Id,
                AuthorName = authorName,
                AuthorIsAdmin = isAdmin,
                Text = text,
                RecipientUserId = recipientUserId,
                RecipientName = recipientName,
                ReplyToCommentId = replyToId,
                CreatedAt = now
            };
            _context.TaskComments.Add(entity);
            lastEntity = entity;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await RefreshTaskCommentPreviewAsync(taskId, cancellationToken);

        if (recipients.Count > 0)
        {
            foreach (var (recipientUserId, _) in recipients)
            {
                await _notificationService.NotifyTaskCommentAddedAsync(
                    task,
                    currentUser.Id,
                    recipientUserId);
            }
        }
        else
        {
            // Без адресатов — только синхронизация превью в таблице, без пушей/инбокса.
            await _notificationService.NotifyTaskUpdatedAsync(task);
        }

        await MarkCommentsReadAsync(taskId, currentUser.Id, cancellationToken);

        if (lastEntity == null)
            return null;

        var list = await LoadCommentDtosAsync(taskId, currentUser.Id, isAdmin, cancellationToken);
        return list.FirstOrDefault(c => c.Id == lastEntity.Id);
    }

    private static List<string> ResolveRecipientUserIds(AddTaskCommentRequest request)
    {
        var ids = new List<string>();
        if (request.RecipientUserIds is { Count: > 0 })
        {
            foreach (var id in request.RecipientUserIds)
            {
                var trimmed = (id ?? "").Trim();
                if (trimmed.Length == 0)
                    continue;
                if (!ids.Contains(trimmed, StringComparer.Ordinal))
                    ids.Add(trimmed);
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.RecipientUserId))
        {
            ids.Add(request.RecipientUserId.Trim());
        }

        return ids;
    }

    public async Task<bool> DeleteCommentAsync(
        int taskId,
        long commentId,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken = default)
    {
        var comment = await _context.TaskComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.ProductionTaskId == taskId, cancellationToken);
        if (comment == null)
            return false;

        if (!await CanAccessTaskAsync(taskId, currentUser, isAdmin, cancellationToken))
            return false;

        if (!CanDelete(comment, currentUser.Id, isAdmin))
            throw new UnauthorizedAccessException("Нельзя удалить этот комментарий");

        _context.TaskComments.Remove(comment);
        await _context.SaveChangesAsync(cancellationToken);
        await RefreshTaskCommentPreviewAsync(taskId, cancellationToken);

        var task = await _context.ProductionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task != null)
            await _notificationService.NotifyTaskUpdatedAsync(task);

        return true;
    }

    public async Task SeedInitialCommentAsync(
        ProductionTask task,
        User author,
        bool authorIsAdmin,
        CancellationToken cancellationToken = default)
    {
        var text = (task.Comment ?? "").Trim();
        if (string.IsNullOrEmpty(text))
            return;

        var exists = await _context.TaskComments
            .AnyAsync(c => c.ProductionTaskId == task.Id, cancellationToken);
        if (exists)
            return;

        _context.TaskComments.Add(new TaskComment
        {
            ProductionTaskId = task.Id,
            AuthorUserId = author.Id,
            AuthorName = string.IsNullOrWhiteSpace(author.FullName)
                ? author.UserName ?? "Админ"
                : author.FullName.Trim(),
            AuthorIsAdmin = authorIsAdmin,
            Text = text,
            IsBaseline = true,
            CreatedAt = _timeService.Now
        });
        await _context.SaveChangesAsync(cancellationToken);
        var preview = await RefreshTaskCommentPreviewAsync(task.Id, cancellationToken);
        task.Comment = preview;
        task.CommentEditedViaDialog = true;
    }

    public async Task<IReadOnlyDictionary<int, int>> GetUnreadBadgeCountsAsync(
        IReadOnlyList<int> taskIds,
        string viewerUserId,
        CancellationToken cancellationToken = default)
    {
        if (taskIds.Count == 0 || string.IsNullOrWhiteSpace(viewerUserId))
            return new Dictionary<int, int>();

        var distinctIds = taskIds.Distinct().ToList();
        var lastReadByTask = await _context.TaskCommentReadStates
            .AsNoTracking()
            .Where(r => r.UserId == viewerUserId && distinctIds.Contains(r.ProductionTaskId))
            .ToDictionaryAsync(r => r.ProductionTaskId, r => r.LastReadCommentId, cancellationToken);

        var comments = await _context.TaskComments
            .AsNoTracking()
            .Where(c => distinctIds.Contains(c.ProductionTaskId) && !c.IsBaseline)
            .Select(c => new
            {
                c.Id,
                c.ProductionTaskId,
                c.AuthorUserId,
                c.RecipientUserId,
                c.ReplyToCommentId
            })
            .ToListAsync(cancellationToken);

        var authorByCommentId = await _context.TaskComments
            .AsNoTracking()
            .Where(c => distinctIds.Contains(c.ProductionTaskId))
            .Select(c => new { c.Id, c.AuthorUserId })
            .ToDictionaryAsync(c => c.Id, c => c.AuthorUserId, cancellationToken);

        var counts = new Dictionary<int, int>();

        foreach (var group in comments.GroupBy(c => c.ProductionTaskId))
        {
            lastReadByTask.TryGetValue(group.Key, out var lastRead);
            var count = 0;
            foreach (var c in group)
            {
                if (c.Id <= lastRead)
                    continue;
                if (string.Equals(c.AuthorUserId, viewerUserId, StringComparison.Ordinal))
                    continue;

                // Базовый комментарий уже отфильтрован; дальше — адресат / всем / ответ мне.
                var forEveryone = string.IsNullOrEmpty(c.RecipientUserId);
                var forMe = string.Equals(c.RecipientUserId, viewerUserId, StringComparison.Ordinal);
                var replyToMe = c.ReplyToCommentId is long replyId
                    && authorByCommentId.TryGetValue(replyId, out var parentAuthor)
                    && string.Equals(parentAuthor, viewerUserId, StringComparison.Ordinal);

                if (forEveryone || forMe || replyToMe)
                    count++;
            }

            if (count > 0)
                counts[group.Key] = count;
        }

        return counts;
    }

    public async Task MarkCommentsReadAsync(
        int taskId,
        string viewerUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(viewerUserId))
            return;

        var maxId = await _context.TaskComments
            .AsNoTracking()
            .Where(c => c.ProductionTaskId == taskId)
            .Select(c => (long?)c.Id)
            .MaxAsync(cancellationToken) ?? 0;

        var state = await _context.TaskCommentReadStates
            .FirstOrDefaultAsync(
                r => r.UserId == viewerUserId && r.ProductionTaskId == taskId,
                cancellationToken);

        if (state == null)
        {
            _context.TaskCommentReadStates.Add(new TaskCommentReadState
            {
                UserId = viewerUserId,
                ProductionTaskId = taskId,
                LastReadCommentId = maxId,
                UpdatedAt = _timeService.Now
            });
        }
        else if (maxId > state.LastReadCommentId)
        {
            state.LastReadCommentId = maxId;
            state.UpdatedAt = _timeService.Now;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<string> RefreshTaskCommentPreviewAsync(int taskId, CancellationToken cancellationToken = default)
    {
        var comments = await _context.TaskComments
            .AsNoTracking()
            .Where(c => c.ProductionTaskId == taskId)
            .OrderBy(c => c.Id)
            .Select(c => new { c.AuthorName, c.RecipientName, c.Text, c.IsBaseline })
            .ToListAsync(cancellationToken);

        var preview = FormatPreview(
            comments.Select(c => new TaskCommentDto
            {
                AuthorName = c.AuthorName,
                RecipientName = c.RecipientName,
                Text = c.Text,
                IsBaseline = c.IsBaseline
            }));

        var task = await _context.ProductionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null)
            return preview;

        var editedViaDialog = comments.Count > 0;
        if (string.Equals(task.Comment, preview, StringComparison.Ordinal)
            && task.CommentEditedViaDialog == editedViaDialog)
        {
            return preview;
        }

        task.Comment = preview;
        task.CommentEditedViaDialog = editedViaDialog;
        task.UpdatedAt = _timeService.Now;
        await _context.SaveChangesAsync(cancellationToken);
        return preview;
    }

    private async Task<IReadOnlyList<TaskCommentDto>> LoadCommentDtosAsync(
        int taskId,
        string currentUserId,
        bool isAdmin,
        CancellationToken cancellationToken)
    {
        var rows = await _context.TaskComments
            .AsNoTracking()
            .Where(c => c.ProductionTaskId == taskId)
            .OrderBy(c => c.Id)
            .ToListAsync(cancellationToken);

        var replyIds = rows
            .Where(c => c.ReplyToCommentId != null)
            .Select(c => c.ReplyToCommentId!.Value)
            .Distinct()
            .ToList();

        var replyMap = replyIds.Count == 0
            ? new Dictionary<long, TaskComment>()
            : await _context.TaskComments
                .AsNoTracking()
                .Where(c => replyIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, cancellationToken);

        return rows.Select(c =>
        {
            TaskCommentReplyPreviewDto? reply = null;
            if (c.ReplyToCommentId is long replyId && replyMap.TryGetValue(replyId, out var parent))
            {
                var preview = parent.Text.Trim();
                if (preview.Length > 80)
                    preview = preview[..80] + "…";
                reply = new TaskCommentReplyPreviewDto
                {
                    Id = parent.Id,
                    // Baseline (первый) комментарий — без имени автора в цитате ответа.
                    AuthorName = parent.IsBaseline ? "" : parent.AuthorName,
                    Preview = preview
                };
            }

            return new TaskCommentDto
            {
                Id = c.Id,
                TaskId = c.ProductionTaskId,
                AuthorUserId = c.AuthorUserId,
                AuthorName = c.AuthorName,
                Text = c.Text,
                RecipientUserId = c.RecipientUserId,
                RecipientName = c.RecipientName,
                ReplyToCommentId = c.ReplyToCommentId,
                ReplyTo = reply,
                CanDelete = CanDelete(c, currentUserId, isAdmin),
                IsBaseline = c.IsBaseline
            };
        }).ToList();
    }

    private static bool CanDelete(TaskComment comment, string currentUserId, bool isAdmin)
    {
        if (comment.AuthorIsAdmin)
            return isAdmin;
        if (isAdmin)
            return true;
        return string.Equals(comment.AuthorUserId, currentUserId, StringComparison.Ordinal);
    }

    private async Task<bool> CanAccessTaskAsync(
        int taskId,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken)
    {
        var task = await _context.ProductionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task == null)
            return false;
        return await CanAccessTaskAsync(task, currentUser, isAdmin, cancellationToken);
    }

    private async Task<bool> CanAccessTaskAsync(
        ProductionTask task,
        User currentUser,
        bool isAdmin,
        CancellationToken cancellationToken)
    {
        if (isAdmin)
            return true;

        if (string.Equals(task.EmployeeName, currentUser.FullName, StringComparison.Ordinal))
            return true;

        if (task.IsSplitTask && task.ParentRowNumber == null)
        {
            var childNames = await _repo.GetChildTasksAsync(task.Id, cancellationToken);
            return childNames.Any(c =>
                string.Equals(c.EmployeeName, currentUser.FullName, StringComparison.Ordinal));
        }

        if (task.ParentRowNumber is int parentId)
        {
            var siblings = await _repo.GetChildTasksAsync(parentId, cancellationToken);
            return siblings.Any(c =>
                string.Equals(c.EmployeeName, currentUser.FullName, StringComparison.Ordinal));
        }

        return false;
    }

    /// <summary>
    /// Разделитель целых комментариев в denormalized preview (не путать с \n внутри текста).
    /// </summary>
    public const char CommentPreviewSeparator = '\u001e';

    internal static string FormatPreview(IEnumerable<TaskCommentDto> comments)
    {
        var list = comments.ToList();
        var blocks = list
            .Select((c, index) =>
            {
                var text = (c.Text ?? "").Trim();
                if (string.IsNullOrEmpty(text))
                    return "";

                // Первый / baseline комментарий — только текст, без отправителя.
                var hideAuthor = c.IsBaseline || index == 0;
                if (hideAuthor)
                {
                    if (!string.IsNullOrWhiteSpace(c.RecipientName))
                        return $"→ {c.RecipientName.Trim()}: {text}";
                    return text;
                }

                var author = string.IsNullOrWhiteSpace(c.AuthorName) ? "—" : c.AuthorName.Trim();
                if (!string.IsNullOrWhiteSpace(c.RecipientName))
                    return $"{author} → {c.RecipientName.Trim()}: {text}";
                return $"{author}: {text}";
            })
            .Where(block => !string.IsNullOrWhiteSpace(block))
            .ToList();
        return string.Join(CommentPreviewSeparator, blocks);
    }

    /// <summary>
    /// Пересобирает denormalized Comment у задач, где в превью ещё виден автор baseline-комментария.
    /// </summary>
    public async Task RebuildStaleBaselinePreviewsAsync(CancellationToken cancellationToken = default)
    {
        var staleTaskIds = await (
            from c in _context.TaskComments.AsNoTracking()
            join t in _context.ProductionTasks.AsNoTracking() on c.ProductionTaskId equals t.Id
            where c.IsBaseline
                && t.Comment != null
                && t.Comment.StartsWith(c.AuthorName + ":")
            select c.ProductionTaskId
        ).Distinct().ToListAsync(cancellationToken);

        foreach (var taskId in staleTaskIds)
            await RefreshTaskCommentPreviewAsync(taskId, cancellationToken);
    }
}
