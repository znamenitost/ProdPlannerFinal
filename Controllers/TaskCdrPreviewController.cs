using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TaskCdrPreviewController : ControllerBase
{
    private readonly ITaskCdrPreviewService _previewService;
    private readonly ICdrPreviewRetryService _retryService;
    private readonly ITaskNotificationService _notificationService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<TaskCdrPreviewController> _logger;

    public TaskCdrPreviewController(
        ITaskCdrPreviewService previewService,
        ICdrPreviewRetryService retryService,
        ITaskNotificationService notificationService,
        ApplicationDbContext db,
        ILogger<TaskCdrPreviewController> logger)
    {
        _previewService = previewService;
        _retryService = retryService;
        _notificationService = notificationService;
        _db = db;
        _logger = logger;
    }

    [HttpGet("{id:int}/cdr-preview")]
    public async Task<IActionResult> GetPreview(int id, CancellationToken cancellationToken)
    {
        try
        {
            var preview = await _previewService.GetAsync(id, cancellationToken);
            if (preview == null)
                return NoContent();

            var (bytes, contentType, updatedAt, sourceKey) = preview.Value;
            Response.Headers[HeaderNames.CacheControl] = "private, max-age=3600";
            Response.Headers[HeaderNames.ETag] = $"\"{updatedAt.Ticks}\"";
            PreviewSourceKeyHeaders.Apply(Response, sourceKey);
            return File(bytes, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка получения превью для задачи {TaskId}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}/cdr-preview")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> SavePreview(
        int id,
        IFormFile? file,
        [FromForm] string? sourceKey,
        CancellationToken cancellationToken)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Файл превью не передан" });

            await using var stream = file.OpenReadStream();
            await _previewService.SaveAsync(id, stream, sourceKey ?? string.Empty, cancellationToken);
            await _retryService.ClearRetryAsync(id, cancellationToken);

            var task = await _db.ProductionTasks
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
            if (task != null)
                await _notificationService.NotifyTaskUpdatedAsync(task);

            return Ok(new { saved = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка сохранения превью для задачи {TaskId}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
