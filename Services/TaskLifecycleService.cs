using ProductionPlanner.Models;
using ProductionPlanner.Data;

namespace ProductionPlanner.Services
{
    public class TaskLifecycleService : ITaskLifecycleService
    {
        private readonly IProductionTaskRepository _repo;
        private readonly IEmployeeStatsService _statsService;
        private readonly IWorkHoursCalculator _workHours;
        private readonly ITaskSplitService _splitService;
        private readonly ITableRowRepository _tableRepo;

        public TaskLifecycleService(
            IProductionTaskRepository repo,
            IEmployeeStatsService statsService,
            IWorkHoursCalculator workHours,
            ITaskSplitService splitService,
            ITableRowRepository tableRepo)
        {
            _repo = repo;
            _statsService = statsService;
            _workHours = workHours;
            _splitService = splitService;
            _tableRepo = tableRepo;
        }

        public async Task StartTaskAsync(int taskId, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status != JobStatus.Assigned) return;

            var startTime = _workHours.GetNextWorkStart(now);
            task.Status = JobStatus.InProgress;
            var interval = new WorkInterval { ProductionTaskId = task.Id, StartTime = startTime, EndTime = null };
            await _repo.AddWorkIntervalAsync(interval);
            await _repo.UpdateTaskAsync(task);

            var tableRow = await _tableRepo.GetRowByIdAsync(task.RowNumber);
            if (tableRow != null && tableRow.StatusText != "Готово")
            {
                tableRow.StatusText = "Начал";
                await _tableRepo.UpdateRowAsync(tableRow);
            }
        }

        public async Task UpdateProgressAsync(int taskId, double newProgress, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status == JobStatus.Completed) return;
            if (newProgress > 0.99) newProgress = 0.99;
            task.Progress = newProgress;
            if (task.Status == JobStatus.Assigned && newProgress > 0)
                task.Status = JobStatus.InProgress;
            await _repo.UpdateTaskAsync(task);
        }

        public async Task CompleteTaskAsync(int taskId, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null) return;
            if (task.Status == JobStatus.Completed) return;

            var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
            if (openInterval != null)
            {
                openInterval.EndTime = now;
                await _repo.UpdateWorkIntervalAsync(openInterval);
            }

            double actual = 0;
            foreach (var interval in task.WorkIntervals.Where(i => i.EndTime.HasValue))
            {
                actual += (interval.EndTime!.Value - interval.StartTime).TotalHours;
            }
            task.ActualHours = actual;
            task.Status = JobStatus.Completed;
            task.CompletedAt = now;
            task.Progress = 1;
            await _repo.UpdateTaskAsync(task);

            double saved = task.EstimateHours - actual;
            await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

            var tableRow = await _tableRepo.GetRowByIdAsync(task.RowNumber);
            if (tableRow != null)
            {
                tableRow.StatusText = "Готово";
                await _tableRepo.UpdateRowAsync(tableRow);
            }

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            {
                await _splitService.AreAllSubtasksCompletedAsync(task.ParentRowNumber.Value);
            }
        }

        public async Task ReturnTaskAsync(int taskId, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status != JobStatus.Completed) return;

            task.Status = JobStatus.Assigned;
            task.CompletedAt = null;
            task.Progress = 0;
            await _repo.UpdateTaskAsync(task);

            var tableRow = await _tableRepo.GetRowByIdAsync(task.RowNumber);
            if (tableRow != null)
            {
                tableRow.StatusText = "";
                await _tableRepo.UpdateRowAsync(tableRow);
            }
        }
    }
}