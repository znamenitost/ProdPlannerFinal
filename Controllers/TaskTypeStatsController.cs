using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/stats")]
[Authorize(Roles = "Admin")]
public class TaskTypeStatsController : ControllerBase
{
    private readonly ITaskTypeStatsService _stats;

    public TaskTypeStatsController(ITaskTypeStatsService stats)
    {
        _stats = stats;
    }

    /// <summary>
    /// Снимок статистики по типам завершённых листовых задач (вся БД). Считается по запросу.
    /// </summary>
    [HttpGet("task-types")]
    public async Task<ActionResult<TaskTypeStatsDto>> GetTaskTypeStats(CancellationToken cancellationToken)
    {
        return Ok(await _stats.GetCompletedLeafStatsAsync(cancellationToken));
    }
}
