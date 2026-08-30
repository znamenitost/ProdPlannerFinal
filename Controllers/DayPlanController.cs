using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.DayPlan;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/day-plan")]
[Authorize]
public class DayPlanController : ControllerBase
{
    private readonly IDayPlanService _dayPlan;
    private readonly IAppTimeService _timeService;
    private readonly UserManager<User> _userManager;

    public DayPlanController(
        IDayPlanService dayPlan,
        IAppTimeService timeService,
        UserManager<User> userManager)
    {
        _dayPlan = dayPlan;
        _timeService = timeService;
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetDayPlan(
        [FromQuery] string employee,
        [FromQuery] string? date,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(employee))
            return BadRequest(new { error = "Employee name is required" });

        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(currentUser, "Admin");
        if (!isAdmin && !string.Equals(employee.Trim(), currentUser.FullName, StringComparison.Ordinal))
            return Forbid();

        var result = await _dayPlan.GetDayPlanAsync(
            employee.Trim(),
            date,
            _timeService.Now,
            cancellationToken);
        return Ok(result);
    }
}
