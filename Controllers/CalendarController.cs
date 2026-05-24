using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
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
    private readonly UserManager<User> _userManager;

    public CalendarController(
        IWeekCalendarService weekCalendar,
        IAppTimeService timeService,
        UserManager<User> userManager)
    {
        _weekCalendar = weekCalendar;
        _timeService = timeService;
        _userManager = userManager;
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek(
        [FromQuery] string employee,
        [FromQuery] string? startDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(employee))
            return BadRequest(new { error = "Employee name is required" });

        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        if (!isAdmin && !string.Equals(employee, currentUser.FullName, StringComparison.Ordinal))
            return Forbid();

        var result = await _weekCalendar.GetWeekAsync(
            employee,
            startDate,
            _timeService.Now,
            cancellationToken);
        return Ok(result);
    }
}
