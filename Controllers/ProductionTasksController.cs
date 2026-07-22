using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Controllers;

/// <summary>
/// CRUD и сортировка строк таблицы задач (api/tasks/table*).
/// </summary>
[ApiController]
[Route("api/tasks")]
[Authorize]
public class ProductionTasksController : ControllerBase
{
    private readonly ILogger<ProductionTasksController> _logger;
    private readonly UserManager<User> _userManager;
    private readonly ITaskTableService _tableService;
    private readonly IProductionTaskRepository _repo;
    private readonly IPlanningWarningService _planningWarnings;
    private readonly IAppTimeService _timeService;
    private readonly ITaskCommentService _taskComments;

    public ProductionTasksController(
        ILogger<ProductionTasksController> logger,
        UserManager<User> userManager,
        ITaskTableService tableService,
        IProductionTaskRepository repo,
        IPlanningWarningService planningWarnings,
        IAppTimeService timeService,
        ITaskCommentService taskComments)
    {
        _logger = logger;
        _userManager = userManager;
        _tableService = tableService;
        _repo = repo;
        _planningWarnings = planningWarnings;
        _timeService = timeService;
        _taskComments = taskComments;
    }

    private async Task<(User? User, string? TargetEmployee)> ResolveViewerAsync(
        string? employee,
        CancellationToken cancellationToken)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
            return (null, null);

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        var targetEmployeeName = (isAdmin && !string.IsNullOrEmpty(employee))
            ? employee
            : currentUser.FullName;

        return (currentUser, targetEmployeeName);
    }

    [HttpGet("table")]
    public async Task<IActionResult> GetTableRows(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? employee = null,
        [FromQuery] bool excludeCompleted = false,
        [FromQuery] string? search = null,
        [FromQuery] bool showFuss = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (currentUser, targetEmployeeName) = await ResolveViewerAsync(employee, cancellationToken);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            var result = await _tableService.GetRowsAsync(
                page,
                pageSize,
                targetEmployeeName!,
                excludeCompleted,
                search,
                isAdmin,
                currentUser.Id,
                showFuss,
                cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTableRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("table/row/{id}")]
    public async Task<IActionResult> GetTableRow(
        int id,
        [FromQuery] string? employee = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (currentUser, targetEmployeeName) = await ResolveViewerAsync(employee, cancellationToken);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            var row = await _tableService.GetRowDtoAsync(
                id,
                targetEmployeeName!,
                isAdmin,
                currentUser.Id,
                cancellationToken);
            if (row == null)
                return NotFound();

            return Ok(row);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTableRow для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Сотруднику через PUT /table/row разрешено менять комментарий (без других полей)
    /// или инфо-статусы (Согласование/Нет изделий) и их резолв (Согласовано/В наличии).
    /// Жизненный цикл (Начал/Пауза/Продолжить/Готово) идёт через выделенные эндпоинты
    /// <c>/api/tasks/{id}/start|pause|resume|complete</c>.
    /// </summary>
    private static bool IsEmployeeCommentOnlyUpdate(UpdateTaskRequest request, TaskTableRowDto task)
    {
        if (request.Comment == null
            || string.Equals(request.Comment, task.Comment, StringComparison.Ordinal))
        {
            return false;
        }

        if (request.SequenceOverride)
            return false;

        if (!string.IsNullOrEmpty(request.StatusText)
            && !string.Equals(request.StatusText, task.StatusText, StringComparison.Ordinal))
        {
            return false;
        }

        return true;
    }

    private static bool IsEmployeeAllowedStatusUpdate(UpdateTaskRequest request)
    {
        if (string.IsNullOrEmpty(request.StatusText))
            return false;

        var target = TaskStatusMapper.FromText(request.StatusText);
        if (target == JobStatus.Assigned && request.SequenceOverride)
            return true;

        return target is
            JobStatus.PendingApproval
            or JobStatus.NoItems
            or JobStatus.Approved
            or JobStatus.InStock;
    }

    [HttpPost("table/row")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateTableRow(
        [FromBody] CreateTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var result = await _tableService.CreateRowAsync(request, cancellationToken);
            if (result.Error != null)
                return BadRequest(new { error = result.Error });

            if (!string.IsNullOrWhiteSpace(request.Comment))
            {
                await _taskComments.SeedInitialCommentAsync(
                    result.Data!,
                    currentUser,
                    authorIsAdmin: true,
                    cancellationToken);
            }

            return Ok(await BuildSaveResponseAsync(result.Data!, request.Parts, cancellationToken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в CreateTableRow");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/row/fuss")]
    public async Task<IActionResult> EnsureFussTableRow(CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            if (string.IsNullOrWhiteSpace(currentUser.FullName))
                return BadRequest(new { error = "У пользователя не задано имя." });

            var result = await _tableService.EnsureFussTaskAsync(
                currentUser.FullName,
                cancellationToken);
            if (result.Error != null)
                return BadRequest(new { error = result.Error });

            return Ok(await BuildSaveResponseAsync(result.Data!, parts: null, cancellationToken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в EnsureFussTableRow");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("table/row/{id}/comments")]
    public async Task<IActionResult> GetTaskComments(int id, CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            var result = await _taskComments.GetCommentsAsync(id, currentUser, isAdmin, cancellationToken);
            if (result == null) return NotFound();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTaskComments для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/row/{id}/comments")]
    public async Task<IActionResult> AddTaskComment(
        int id,
        [FromBody] AddTaskCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            var created = await _taskComments.AddCommentAsync(
                id,
                currentUser,
                isAdmin,
                request,
                cancellationToken);
            if (created == null) return NotFound();
            return Ok(created);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в AddTaskComment для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("table/row/{id}/comments/{commentId:long}")]
    public async Task<IActionResult> DeleteTaskComment(
        int id,
        long commentId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            var deleted = await _taskComments.DeleteCommentAsync(
                id,
                commentId,
                currentUser,
                isAdmin,
                cancellationToken);
            if (!deleted) return NotFound();
            return Ok();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в DeleteTaskComment для id {Id}, comment {CommentId}", id, commentId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Редактирует строку. Админ может менять любые поля; сотрудник — комментарий или статус
    /// и только своей задачи (включая инфо-статусы); чужие данные не попадают в
    /// PUT, потому что обновление полей принимается только когда зовущий — админ.
    /// </summary>
    [HttpPut("table/row/{id}")]
    public async Task<IActionResult> UpdateTableRow(
        int id,
        [FromBody] UpdateTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");

            if (!isAdmin)
            {
                var task = await _tableService.GetRowDtoAsync(
                    id,
                    currentUser.FullName,
                    viewerIsAdmin: false,
                    viewerUserId: currentUser.Id,
                    cancellationToken: cancellationToken);
                if (task == null) return NotFound();

                var isOwnTask = string.Equals(task.EmployeeName, currentUser.FullName, StringComparison.Ordinal)
                    || task.HasCurrentUserSubtask;
                if (!isOwnTask)
                    return Forbid();

                if (request.PriorityMarked.HasValue)
                    return Forbid();

                var commentOnly = IsEmployeeCommentOnlyUpdate(request, task);
                if (!commentOnly && !IsEmployeeAllowedStatusUpdate(request))
                    return Forbid();

                if (task.IsFuss && !commentOnly && IsEmployeeAllowedStatusUpdate(request))
                    return Forbid();

                var expectedUpdatedAt = request.ExpectedUpdatedAt;

                // Сотруднику разрешено менять только комментарий или статус; остальное берём
                // из текущей записи, чтобы он не мог переписать дедлайн, часы, тип, сотрудника и пр.
                request = new UpdateTaskRequest
                {
                    FolderPath = task.FolderPath,
                    FileName = task.FileName,
                    Comment = commentOnly ? request.Comment : task.Comment,
                    Deadline = task.Deadline,
                    EstimateHours = task.EstimateHours,
                    Type = task.Type,
                    EmployeeName = task.EmployeeName,
                    ParentRowNumber = task.ParentRowNumber,
                    StatusText = commentOnly ? null : request.StatusText,
                    PriorityMarked = null,
                    SequenceOverride = commentOnly ? false : request.SequenceOverride,
                    CommentEditedViaDialog = commentOnly ? request.CommentEditedViaDialog : null,
                    ExpectedUpdatedAt = expectedUpdatedAt
                };
            }

            var result = await _tableService.UpdateRowAsync(id, request, cancellationToken);
            if (result.NotFound)
                return NotFound();
            if (result.Error != null)
                return BadRequest(new { error = result.Error });

            if (!isAdmin)
            {
                if (result.ReplacedTaskId.HasValue)
                    return Ok(new { task = result.Data, replacedTaskId = result.ReplacedTaskId.Value });
                return Ok(result.Data);
            }

            return Ok(await BuildSaveResponseAsync(
                result.Data!,
                parts: null,
                cancellationToken,
                result.ReplacedTaskId));
        }
        catch (TaskConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Concurrency conflict in UpdateTableRow for id {Id}", id);
            return Conflict(new { error = ex.Message, code = "concurrency_conflict" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в UpdateTableRow для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("table/row/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTableRow(int id, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _tableService.DeleteRowAsync(id, cancellationToken);
            if (result.NotFound)
                return NotFound();
            return Ok();
        }
        catch (TaskConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Concurrency conflict in DeleteTableRow for id {Id}", id);
            return Conflict(new { error = ex.Message, code = "concurrency_conflict" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в DeleteTableRow для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/row/{id}/delete")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteTableRowPost(int id, CancellationToken cancellationToken = default) =>
        DeleteTableRow(id, cancellationToken);

    [HttpGet("table/row/{id}/intervals")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetTableRowIntervals(
        int id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _tableService.GetIntervalsAsync(id, cancellationToken);
            if (result.NotFound) return NotFound();
            if (result.Error != null) return BadRequest(new { error = result.Error });
            return Ok(result.Data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTableRowIntervals для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("table/row/{id}/intervals")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateTableRowIntervals(
        int id,
        [FromBody] UpdateWorkIntervalsRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _tableService.UpdateIntervalsAsync(id, request, cancellationToken);
            if (result.NotFound) return NotFound();
            if (result.Error != null) return BadRequest(new { error = result.Error });
            return Ok(result.Data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в UpdateTableRowIntervals для id {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ReorderRows(
        [FromBody] List<int> orderedIds,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await _tableService.ReorderRowsAsync(orderedIds, cancellationToken);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в ReorderRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private async Task<object> BuildSaveResponseAsync(
        ProductionTask task,
        List<SplitPart>? parts,
        CancellationToken cancellationToken,
        int? replacedTaskId = null)
    {
        HashSet<int> focusIds;
        List<string> employees;

        if (task.IsSplitTask && task.ParentRowNumber == null)
        {
            var children = await _repo.GetChildTasksAsync(task.Id, cancellationToken);
            focusIds = children.Select(c => c.Id).ToHashSet();
            employees = children.Select(c => c.EmployeeName).ToList();
        }
        else
        {
            focusIds = new HashSet<int> { task.Id };
            employees = new List<string> { task.EmployeeName };
        }

        if (parts is { Count: > 0 })
        {
            foreach (var p in parts.Where(p => !string.IsNullOrWhiteSpace(p.EmployeeName)))
                employees.Add(p.EmployeeName);
        }

        var warnings = await _planningWarnings.GetWarningsForEmployeesAsync(
            employees,
            _timeService.Now,
            focusIds,
            cancellationToken);

        if (replacedTaskId.HasValue)
            return new { task, planningWarnings = warnings, replacedTaskId = replacedTaskId.Value };

        return new { task, planningWarnings = warnings };
    }
}
