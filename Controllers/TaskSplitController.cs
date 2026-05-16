using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Data;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/tasks/split")]
    [Authorize]
    public class TaskSplitController : ControllerBase
    {
        private readonly ITaskSplitService _splitService;
        private readonly IProductionTaskRepository _repo;
        private readonly UserManager<User> _userManager;

        public TaskSplitController(ITaskSplitService splitService, IProductionTaskRepository repo, UserManager<User> userManager)
        {
            _splitService = splitService;
            _repo = repo;
            _userManager = userManager;
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
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
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var children = await _splitService.GetChildTasksAsync(parentRowNumber);

            var result = children.Select(c => new
            {
                c.Id,
                c.DisplayOrder,
                c.FolderPath,
                c.FileName,
                c.Comment,
                StatusText = MapStatusToText(c.Status),
                c.Deadline,
                c.EstimateHours,
                c.Type,
                c.EmployeeName,
                c.CreatedAt,
                c.UpdatedAt,
                c.ParentRowNumber,
                c.IsSplitTask,
                c.Progress
            });
            return Ok(result);
        }

        [HttpGet("check-completion/{parentRowNumber}")]
        public async Task<IActionResult> CheckCompletion(int parentRowNumber)
        {
            var completed = await _splitService.AreAllSubtasksCompletedAsync(parentRowNumber);
            return Ok(new { parentRowNumber, allCompleted = completed });
        }

        private string MapStatusToText(JobStatus status) => status switch
        {
            JobStatus.Assigned => "",
            JobStatus.InProgress => "Начал",
            JobStatus.Paused => "Пауза",
            JobStatus.Completed => "Готово",
            _ => ""
        };
    }
}