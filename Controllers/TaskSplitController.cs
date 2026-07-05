using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.TaskTable;
using ProductionPlanner.Services.TaskCdrPreview;
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
        private readonly IPlanningWarningService _planningWarnings;
        private readonly UserManager<User> _userManager;
        private readonly ITaskCdrPreviewService _cdrPreviewService;

        public TaskSplitController(
            ITaskSplitService splitService,
            IProductionTaskRepository repo,
            IAppTimeService timeService,
            IPlanningWarningService planningWarnings,
            UserManager<User> userManager,
            ITaskCdrPreviewService cdrPreviewService)
        {
            _splitService = splitService;
            _repo = repo;
            _timeService = timeService;
            _planningWarnings = planningWarnings;
            _userManager = userManager;
            _cdrPreviewService = cdrPreviewService;
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
                    request.SupplyMode,
                    cancellationToken);
                var planningWarnings = await GetSplitPlanningWarningsAsync(parent.Id, cancellationToken);
                return Ok(new
                {
                    message = "Задача успешно разделена",
                    estimateHours = parent.EstimateHours,
                    isSplitTask = parent.IsSplitTask,
                    employeeName = parent.EmployeeName,
                    type = parent.Type,
                    supplyMode = parent.SupplyMode,
                    planningWarnings
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
                    request.SupplyMode,
                    cancellationToken);
                var planningWarnings = await GetSplitPlanningWarningsAsync(parent.Id, cancellationToken);
                return Ok(new
                {
                    message = "Назначения обновлены",
                    estimateHours = parent.EstimateHours,
                    isSplitTask = parent.IsSplitTask,
                    employeeName = parent.EmployeeName,
                    type = parent.Type,
                    supplyMode = parent.SupplyMode,
                    planningWarnings
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
            var parent = await _repo.GetTaskByIdAsync(parentRowNumber, cancellationToken);
            var splits = await _repo.GetTaskSplitsByParentIdAsync(parentRowNumber, cancellationToken);
            var sequenceByChild = splits.ToDictionary(s => s.ChildTaskId, s => s.SequenceOrder);
            var childIds = children.Select(c => c.Id).ToList();
            var previewIds = await _cdrPreviewService.GetExistingTaskIdsAsync(childIds, cancellationToken);
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
                    commentEditedViaDialog = c.CommentEditedViaDialog,
                    StatusText = TaskStatusMapper.ToText(c.Status),
                    status = (int)c.Status,
                    isPriorityMarked = c.IsPriorityMarked,
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
                    supplyMode = parent?.SupplyMode ?? SupplyMode.None,
                    sequenceOrder = sequenceByChild.GetValueOrDefault(c.Id, 0),
                    sequenceStartBlocked = parent?.SupplyMode == SupplyMode.InternalProduction
                        && c.Status == JobStatus.Waiting,
                    workIntervals,
                    showPlannedTimeProgress = PlannedTimeProgressCalculator.ShouldShow(c, intervals),
                    plannedTimeProgress = PlannedTimeProgressCalculator.GetPercent(
                        c,
                        intervals,
                        _timeService.Now),
                    requiresTestBeforeProduction = c.RequiresTestBeforeProduction,
                    testEstimateHours = c.TestEstimateHours,
                    productionEstimateHours = c.ProductionEstimateHours,
                    workPhase = (int)c.WorkPhase,
                    hasCdrPreview = previewIds.Contains(c.Id)
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

        private async Task<IReadOnlyList<PlanningWarningDto>> GetSplitPlanningWarningsAsync(
            int parentId,
            CancellationToken cancellationToken)
        {
            var children = await _repo.GetChildTasksAsync(parentId, cancellationToken);
            var focusIds = children.Select(c => c.Id).ToHashSet();
            var employees = children.Select(c => c.EmployeeName);
            return await _planningWarnings.GetWarningsForEmployeesAsync(
                employees,
                _timeService.Now,
                focusIds,
                cancellationToken);
        }

    }
}