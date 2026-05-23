using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.TaskTable;
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
        private readonly IAppTimeService _timeService;
        private readonly UserManager<User> _userManager;

        public TaskSplitController(
            ITaskSplitService splitService,
            IProductionTaskRepository repo,
            IAppTimeService timeService,
            UserManager<User> userManager)
        {
            _splitService = splitService;
            _repo = repo;
            _timeService = timeService;
            _userManager = userManager;
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SplitTask(
            [FromBody] SplitTaskRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var parent = await _splitService.SplitTaskAsync(
                    request.ParentTaskId,
                    request.Parts,
                    cancellationToken);
                return Ok(new
                {
                    message = "Задача успешно разделена",
                    estimateHours = parent.EstimateHours,
                    isSplitTask = parent.IsSplitTask,
                    employeeName = parent.EmployeeName,
                    type = parent.Type
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{parentTaskId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSplit(
            int parentTaskId,
            [FromBody] SplitTaskRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var parent = await _splitService.UpdateSplitAsync(
                    parentTaskId,
                    request.Parts,
                    cancellationToken);
                return Ok(new
                {
                    message = "Назначения обновлены",
                    estimateHours = parent.EstimateHours,
                    isSplitTask = parent.IsSplitTask,
                    employeeName = parent.EmployeeName,
                    type = parent.Type
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("children/{parentRowNumber}")]
        public async Task<IActionResult> GetChildTasks(
            int parentRowNumber,
            CancellationToken cancellationToken)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var children = await _splitService.GetChildTasksAsync(parentRowNumber, cancellationToken);
            var childIds = children.Select(c => c.Id).ToList();
            var intervalsByTask = (await _repo.GetWorkIntervalsForTaskIdsAsync(childIds, cancellationToken))
                .GroupBy(i => i.ProductionTaskId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = children.Select(c =>
            {
                intervalsByTask.TryGetValue(c.Id, out var intervals);
                intervals ??= [];
                var workIntervals = intervals.Select(WorkIntervalDto.FromEntity).ToList();
                return new
                {
                    c.Id,
                    c.DisplayOrder,
                    c.FolderPath,
                    c.FileName,
                    c.Comment,
                    StatusText = TaskStatusMapper.ToText(c.Status),
                    Status = c.Status.ToString(),
                    c.Deadline,
                    c.EstimateHours,
                    c.ActualHours,
                    c.Type,
                    c.EmployeeName,
                    c.CreatedAt,
                    c.UpdatedAt,
                    c.ParentRowNumber,
                    c.IsSplitTask,
                    c.Progress,
                    workIntervals,
                    showPlannedTimeProgress = PlannedTimeProgressCalculator.ShouldShow(c, intervals),
                    plannedTimeProgress = PlannedTimeProgressCalculator.GetPercent(
                        c,
                        intervals,
                        _timeService.Now)
                };
            });
            return Ok(result);
        }

        [HttpGet("check-completion/{parentRowNumber}")]
        public async Task<IActionResult> CheckCompletion(int parentRowNumber)
        {
            var completed = await _splitService.AreAllSubtasksCompletedAsync(parentRowNumber);
            return Ok(new { parentRowNumber, allCompleted = completed });
        }

    }
}