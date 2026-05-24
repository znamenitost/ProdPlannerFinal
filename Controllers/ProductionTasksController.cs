using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
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

    public ProductionTasksController(
        ILogger<ProductionTasksController> logger,
        UserManager<User> userManager,
        ITaskTableService tableService)
    {
        _logger = logger;
        _userManager = userManager;
        _tableService = tableService;
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
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (currentUser, targetEmployeeName) = await ResolveViewerAsync(employee, cancellationToken);
            if (currentUser == null) return Unauthorized();

            var result = await _tableService.GetRowsAsync(page, pageSize, targetEmployeeName!, cancellationToken);
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

            var row = await _tableService.GetRowDtoAsync(id, targetEmployeeName!, cancellationToken);
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
    /// Сотруднику через PUT /table/row разрешено менять только инфо-статусы (Согласование/Нет изделий)
    /// и их резолв (Согласовано/В наличии). Жизненный цикл (Начал/Пауза/Продолжить/Готово)
    /// идёт через выделенные эндпоинты <c>/api/tasks/{id}/start|pause|resume|complete</c>.
    /// </summary>
    private static bool IsEmployeeAllowedStatusUpdate(UpdateTaskRequest request)
    {
        if (string.IsNullOrEmpty(request.StatusText))
            return false;

        return TaskStatusMapper.FromText(request.StatusText) is
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
            var result = await _tableService.CreateRowAsync(request, cancellationToken);
            if (result.Error != null)
                return BadRequest(new { error = result.Error });
            return Ok(result.Data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в CreateTableRow");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Редактирует строку. Админ может менять любые поля; сотрудник — только статус
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
                var task = await _tableService.GetRowDtoAsync(id, currentUser.FullName, cancellationToken);
                if (task == null) return NotFound();

                var isOwnTask = string.Equals(task.EmployeeName, currentUser.FullName, StringComparison.Ordinal)
                    || task.HasCurrentUserSubtask;
                if (!isOwnTask)
                    return Forbid();

                if (!IsEmployeeAllowedStatusUpdate(request))
                    return Forbid();

                // Сотруднику разрешено менять только статус; остальное берём из текущей записи,
                // чтобы он не мог переписать дедлайн, часы, тип, сотрудника и пр.
                request = new UpdateTaskRequest
                {
                    FolderPath = task.FolderPath,
                    FileName = task.FileName,
                    Comment = task.Comment,
                    Deadline = task.Deadline,
                    EstimateHours = task.EstimateHours,
                    Type = task.Type,
                    EmployeeName = task.EmployeeName,
                    ParentRowNumber = task.ParentRowNumber,
                    StatusText = request.StatusText
                };
            }

            var result = await _tableService.UpdateRowAsync(id, request, cancellationToken);
            if (result.NotFound)
                return NotFound();
            return Ok(result.Data);
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в DeleteTableRow для id {Id}", id);
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
}
