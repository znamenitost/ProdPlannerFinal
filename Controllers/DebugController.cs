using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Data;
using ProductionPlanner.Services;
using ProductionPlanner.Models;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/debug")]
    public class DebugController : ControllerBase
    {
        private readonly IProductionTaskRepository _repo;
        private readonly ApplicationDbContext _context;
        private static DateTime? _mockDateTime = null;

        public DebugController(IProductionTaskRepository repo, ApplicationDbContext context)
        {
            _repo = repo;
            _context = context;
        }

        // Получить текущее моковое время или реальное
        public static DateTime GetCurrentTime()
        {
            return _mockDateTime ?? DateTime.Now;
        }

        [HttpPost("set-time")]
        public IActionResult SetTime([FromBody] SetTimeRequest request)
        {
            if (DateTime.TryParse(request.MockDateTime, out var mockTime))
            {
                _mockDateTime = mockTime;
                return Ok(new { message = $"Time set to {mockTime}" });
            }
            return BadRequest(new { message = "Invalid date format" });
        }

        [HttpPost("reset-time")]
        public IActionResult ResetTime()
        {
            _mockDateTime = null;
            return Ok(new { message = "Time reset to real" });
        }

        [HttpPost("close-interval/{taskId}")]
        public async Task<IActionResult> CloseInterval(int taskId)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null) return NotFound();

            var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
            if (openInterval != null)
            {
                openInterval.EndTime = GetCurrentTime();
                await _repo.UpdateWorkIntervalAsync(openInterval);
            }
            return Ok();
        }

        [HttpPost("create-interval/{taskId}")]
        public async Task<IActionResult> CreateInterval(int taskId)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null) return NotFound();

            // Закрываем старые открытые интервалы
            foreach (var interval in task.WorkIntervals.Where(i => i.EndTime == null))
            {
                interval.EndTime = GetCurrentTime();
                await _repo.UpdateWorkIntervalAsync(interval);
            }

            // Создаём новый
            var newInterval = new WorkInterval
            {
                ProductionTaskId = task.Id,
                StartTime = GetCurrentTime(),
                EndTime = null
            };
            await _repo.AddWorkIntervalAsync(newInterval);
            
            task.Status = JobStatus.InProgress;
            await _repo.UpdateTaskAsync(task);
            
            return Ok();
        }

        [HttpPost("reset-db")]
        public async Task<IActionResult> ResetDatabase()
        {
            // Удаляем все интервалы
            await _repo.DeleteAllWorkIntervalsAsync();
            
            // Удаляем все ProductionTask
            await _repo.DeleteAllTasksAsync();
            
            // Удаляем все TaskSplit
            var allSplits = _context.TaskSplits.ToList();
            _context.TaskSplits.RemoveRange(allSplits);
            
            // Удаляем все TableRows
            var allTableRows = _context.TableRows.ToList();
            _context.TableRows.RemoveRange(allTableRows);
            
            // Сбрасываем статистику
            var stats = await _repo.GetEmployeeStatAsync("Дима");
            if (stats != null)
            {
                stats.TotalSavedHours = 0;
                stats.TodaySavedHours = 0;
                await _repo.UpdateEmployeeStatAsync(stats);
            }
            
            // Обновляем порядок (переиндексация)
            await _context.SaveChangesAsync();
            
            return Ok(new { message = "База данных полностью очищена" });
        }

        [HttpGet("get-intervals/{taskId}")]
        public async Task<IActionResult> GetIntervals(int taskId)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null) return NotFound();
            return Ok(task.WorkIntervals.Select(i => new { i.Id, i.StartTime, i.EndTime }));
        }
    }

    public class SetTimeRequest
    {
        public string MockDateTime { get; set; } = "";
    }
}