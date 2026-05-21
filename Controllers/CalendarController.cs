using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ProductionPlanner.Services;
using ProductionPlanner.Services.Calendar;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly IWeekCalendarService _weekCalendar;
    private readonly IAppTimeService _timeService;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(
        IWeekCalendarService weekCalendar,
        IAppTimeService timeService,
        ILogger<CalendarController> logger)
    {
        _weekCalendar = weekCalendar;
        _timeService = timeService;
        _logger = logger;
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek(
        [FromQuery] string employee,
        [FromQuery] string? startDate,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrEmpty(employee))
                return BadRequest(new { error = "Employee name is required" });

            var result = await _weekCalendar.GetWeekAsync(
                employee,
                startDate,
                _timeService.Now,
                cancellationToken);
            return Ok(new { start = result.Start, days = result.Days });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка в GetWeek для сотрудника {Employee}", employee);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
