using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Infrastructure;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/deploy")]
[Authorize(Roles = "Admin")]
public class DeployController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<DeployController> _logger;

    public DeployController(IWebHostEnvironment environment, ILogger<DeployController> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("prepare")]
    public IActionResult PrepareMaintenance()
    {
        var spritesDir = AppOfflineSpritePaths.Resolve(_environment);
        if (!Directory.Exists(spritesDir))
            return BadRequest(new { message = "Не найдены спрайты для страницы обновления." });

        var offlinePath = Path.Combine(_environment.ContentRootPath, "app_offline.htm");
        var html = AppOfflineMaintenancePage.Render(_environment);

        try
        {
            System.IO.File.WriteAllText(offlinePath, html, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Не удалось записать app_offline.htm в {Path}", offlinePath);
            return StatusCode(500, new { message = "Не удалось включить режим обновления. Проверьте права на запись в папку приложения." });
        }

        _logger.LogWarning("Включён режим обновления: записан {Path}", offlinePath);
        return Ok(new { message = "Режим обновления включён. Приложение остановится через несколько секунд." });
    }
}
