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

    [HttpGet("table")]
    public async Task<IActionResult> GetTableRows(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? employee = null)
    {
        try
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
            var targetEmployeeName = (isAdmin && !string.IsNullOrEmpty(employee))
                ? employee
                : currentUser.FullName;

            var result = await _tableService.GetRowsAsync(page, pageSize, targetEmployeeName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetTableRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("table/row")]
    public async Task<IActionResult> CreateTableRow([FromBody] CreateTaskRequest request)
    {
        try
        {
            var result = await _tableService.CreateRowAsync(request);
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
    public async Task<IActionResult> UpdateTableRow(int id, [FromBody] UpdateTaskRequest request)
    {
        try
        {
            var result = await _tableService.UpdateRowAsync(id, request);
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
    public async Task<IActionResult> DeleteTableRow(int id)
    {
        try
        {
            var result = await _tableService.DeleteRowAsync(id);
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
    public async Task<IActionResult> ReorderRows([FromBody] List<int> orderedIds)
    {
        try
        {
            await _tableService.ReorderRowsAsync(orderedIds);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в ReorderRows");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
