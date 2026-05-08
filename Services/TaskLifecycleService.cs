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

        public async Task StartTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] StartTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null)
                throw new Exception($"Задача {taskId} не найдена");

            if (task.Status != JobStatus.Assigned)
                throw new Exception($"Невозможно запустить задачу в статусе {task.Status}. Используйте Resume для паузы.");

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

            var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
            if (openInterval != null)
            {
                openInterval.EndTime = now;
                await _repo.UpdateWorkIntervalAsync(openInterval);
                Console.WriteLine($"[DEBUG] Closed interval for task {taskId} at {now}");
            }

            task.Status = JobStatus.Paused;
            task.UpdatedAt = now;
            await _repo.UpdateTaskAsync(task);
        }

        public async Task ResumeTaskAsync(int taskId, DateTime now)
        {
            Console.WriteLine($"[DEBUG] ResumeTaskAsync called with time: {now}");

            var task = await _repo.GetTaskByIdAsync(taskId);
            if (task == null)
                throw new Exception($"Задача {taskId} не найдена");

            if (task.Status != JobStatus.Paused)
                throw new Exception($"Невозможно возобновить задачу в статусе {task.Status}");

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

            // Автоматический старт, если задача не была начата
            if (task.Status == JobStatus.Assigned)
            {
                Console.WriteLine($"[DEBUG] Task {taskId} was not started, auto-starting before completion");
                await StartTaskAsync(taskId, now);
                task = await _repo.GetTaskByIdAsync(taskId);
                if (task == null) return;
            }

            // Закрываем открытый интервал (если есть)
            var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
            if (openInterval != null)
            {
                openInterval.EndTime = now;
                await _repo.UpdateWorkIntervalAsync(openInterval);
                Console.WriteLine($"[DEBUG] Closed interval for task {taskId} at {now}");
            }

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

            double saved = task.EstimateHours - actual;
            await _statsService.AddSavedHoursAsync(task.EmployeeName, saved, now);

            if (task.ParentRowNumber.HasValue && task.IsSplitTask)
            {
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