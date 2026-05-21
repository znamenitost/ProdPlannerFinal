using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Services.TaskTable;
using ProductionPlanner.Models;

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

    [HttpPost("table/row")]
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

    [HttpPut("table/row/{id}")]
    public async Task<IActionResult> UpdateTableRow(
        int id,
        [FromBody] UpdateTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
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
