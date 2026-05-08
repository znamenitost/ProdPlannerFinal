using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Data;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/tasks/split")]
    public class TaskSplitController : ControllerBase
    {
        private readonly ITaskSplitService _splitService;
        private readonly IProductionTaskRepository _repo;

        public TaskSplitController(ITaskSplitService splitService, IProductionTaskRepository repo)
        {
            _splitService = splitService;
            _repo = repo;
        }

        [HttpPost]
        public async Task<IActionResult> SplitTask([FromBody] SplitTaskRequest request)
        {
            try
            {
                await _splitService.SplitTaskAsync(request.ParentTaskId, request.Parts);
                return Ok(new { message = "Задача успешно разделена" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("children/{parentRowNumber}")]
        public async Task<IActionResult> GetChildTasks(int parentRowNumber)
        {
            var children = await _splitService.GetChildTasksAsync(parentRowNumber);
            // Заменяем Title на FileName
            return Ok(children.Select(c => new { c.Id, Title = c.FileName, c.EmployeeName, c.Status, c.Progress }));
        }

        [HttpGet("check-completion/{parentRowNumber}")]
        public async Task<IActionResult> CheckCompletion(int parentRowNumber)
        {
            var completed = await _splitService.AreAllSubtasksCompletedAsync(parentRowNumber);
            return Ok(new { parentRowNumber, allCompleted = completed });
        }
    }
}