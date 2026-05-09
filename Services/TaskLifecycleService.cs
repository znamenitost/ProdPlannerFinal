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
        private readonly IAppTimeService _timeService;

        public TaskLifecycleService(
            IProductionTaskRepository repo,
            IEmployeeStatsService statsService,
            IWorkHoursCalculator workHours,
            ITaskSplitService splitService,
            IAppTimeService timeService)
        {
            _repo = repo;
            _statsService = statsService;
            _workHours = workHours;
            _splitService = splitService;
            _timeService = timeService;
        }

        private async Task CloseAllOpenIntervalsAsync(ProductionTask task, DateTime closedAt)
        {
            var openIntervals = task.WorkIntervals.Where(i => i.EndTime == null).ToList();
            foreach (var interval in openIntervals)
            {
                interval.EndTime = closedAt;
                await _repo.UpdateWorkIntervalAsync(interval);
                Console.WriteLine($"[DEBUG] Закрыт 'висящий' интервал {interval.Id} для задачи {task.Id} в {closedAt}");
            }
        }

        private async Task UpdateParentStatusAsync(int childTaskId)
        {
            var child = await _repo.GetTaskByIdAsync(childTaskId);
            if (child?.ParentRowNumber == null) return;

            var parent = await _repo.GetTaskByIdAsync(child.ParentRowNumber.Value);
            if (parent == null || !parent.IsSplitTask) return;

            var allChildren = await _repo.GetChildTasksAsync(parent.Id);
            if (!allChildren.Any()) return;

            JobStatus newStatus;
            if (allChildren.All(c => c.Status == JobStatus.Completed))
                newStatus = JobStatus.Completed;
            else if (allChildren.Any(c => c.Status == JobStatus.Completed || c.Status == JobStatus.InProgress || c.Status == JobStatus.Paused))
                newStatus = JobStatus.InProgress;
            else
                newStatus = JobStatus.Assigned;

            if (parent.Status != newStatus)
            {
                parent.Status = newStatus;
                parent.UpdatedAt = _timeService.Now;
                await _repo.UpdateTaskAsync(parent);
            }
        }

        public async Task StartTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] StartTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null)
                throw new Exception($"Задача {taskId} не найдена");

            if (task.Status != JobStatus.Assigned)
                throw new Exception($"Невозможно запустить задачу в статусе {task.Status}. Используйте Resume для паузы.");

            await CloseAllOpenIntervalsAsync(task, now);

            var startTime = _workHours.GetNextWorkStart(now);
            task.Status = JobStatus.InProgress;
            task.UpdatedAt = now;

            var interval = new WorkInterval
            {
                ProductionTaskId = task.Id,
                StartTime = startTime,
                EndTime = null
            };

            await _repo.AddWorkIntervalAsync(interval);
            await _repo.UpdateTaskAsync(task);

            // Обновляем статус родителя, если это дочерняя задача
            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id);

            Console.WriteLine($"[DEBUG] Task {taskId} started, interval start: {startTime}");
        }

        public async Task PauseTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] PauseTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null)
                throw new Exception($"Задача {taskId} не найдена");

            if (task.Status != JobStatus.InProgress)
                throw new Exception($"Невозможно поставить на паузу задачу в статусе {task.Status}");

            await CloseAllOpenIntervalsAsync(task, now);

            task.Status = JobStatus.Paused;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id);
        }

        public async Task ResumeTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] ResumeTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null)
                throw new Exception($"Задача {taskId} не найдена");

            if (task.Status != JobStatus.Paused)
                throw new Exception($"Невозможно возобновить задачу в статусе {task.Status}");

            await CloseAllOpenIntervalsAsync(task, now);

            var startTime = _workHours.GetNextWorkStart(now);
            task.Status = JobStatus.InProgress;
            task.UpdatedAt = now;

            var interval = new WorkInterval
            {
                ProductionTaskId = task.Id,
                StartTime = startTime,
                EndTime = null
            };

            await _repo.AddWorkIntervalAsync(interval);
            await _repo.UpdateTaskAsync(task);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                await UpdateParentStatusAsync(task.Id);

            Console.WriteLine($"[DEBUG] Task {taskId} resumed, interval start: {startTime}");
        }

        public async Task UpdateProgressAsync(int taskId, double newProgress, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status == JobStatus.Completed) return;
            if (newProgress > 0.99) newProgress = 0.99;

            if (task.Status == JobStatus.Assigned && newProgress > 0)
            {
                Console.WriteLine($"[DEBUG] Auto-starting task {taskId} because progress set to {newProgress}");
                await StartTaskAsync(taskId, now);
                task = await _repo.GetTaskByIdAsync(taskId);
                if (task == null) return;
            }

            task.Progress = newProgress;
            task.UpdatedAt = now;

            if (task.Status == JobStatus.Assigned && newProgress > 0)
                task.Status = JobStatus.InProgress;

            await _repo.UpdateTaskAsync(task);
        }

        public async Task CompleteTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] CompleteTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status == JobStatus.Completed) return;

            // Если задача не была запущена, не создаём интервал
            if (task.Status == JobStatus.Assigned)
            {
                task.Status = JobStatus.Completed;
                task.CompletedAt = now;
                task.Progress = 1;
                task.UpdatedAt = now;
                await _repo.UpdateTaskAsync(task);
                
                double savedHours = task.EstimateHours - 0;  // ← переименовано
                await _statsService.AddSavedHoursAsync(task.EmployeeName, savedHours, now);

                if (task.ParentRowNumber.HasValue && task.IsSplitTask)
                    await UpdateParentStatusAsync(task.Id);

                return;
            }

            // В противном случае закрываем все интервалы и считаем фактическое время
            await CloseAllOpenIntervalsAsync(task, now);

            double actual = 0;
            foreach (var interval in task.WorkIntervals)
            {
                if (interval.EndTime.HasValue)
                {
                    actual += (interval.EndTime.Value - interval.StartTime).TotalHours;
                }
            }
            task.ActualHours = actual;
            task.Status = JobStatus.Completed;
            task.CompletedAt = now;
            task.Progress = 1;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task);

            double saved = task.EstimateHours - actual;  // ← оставлено как было
            await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            {
                await UpdateParentStatusAsync(task.Id);
                var parentId = task.ParentRowNumber.Value;
                var allCompleted = await _splitService.AreAllSubtasksCompletedAsync(parentId);
                if (allCompleted)
                {
                    var parentTask = await _repo.GetTaskByIdAsync(parentId);
                    if (parentTask != null && parentTask.IsSplitTask)
                    {
                        await _repo.DeleteTaskAsync(parentId);
                    }
                }
            }
        }

        public async Task ReturnTaskAsync(int taskId, DateTime now)
        {
            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null || task.Status != JobStatus.Completed) return;

            task.Status = JobStatus.Assigned;
            task.CompletedAt = null;
            task.Progress = 0;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task);
        }
    }
}