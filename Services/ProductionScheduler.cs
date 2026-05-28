using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public class ProductionScheduler : IProductionScheduler
    {
        private readonly IWorkHoursCalculator _workHours;

        public ProductionScheduler(IWorkHoursCalculator workHours)
        {
            _workHours = workHours;
        }

        public List<ScheduledSlot> GetSchedule(List<ProductionTask> activeTasks, DateTime now)
        {
            var tasks = activeTasks
                .Where(t => t.Status != JobStatus.Completed)
                .OrderBy(t => t.Deadline)
                .ToList();

            var result = new List<ScheduledSlot>();
            var cursor = _workHours.GetNextWorkStart(AppDateTime.ToMoscowWallClockFromApp(now));

            foreach (var task in tasks)
            {
                var remainingHours = task.EstimateHours * (1 - task.Progress);
                if (remainingHours <= 0.01) continue;

                var segments = _workHours.AllocateWorkTime(cursor, remainingHours);
                foreach (var segment in segments)
                {
                    result.Add(new ScheduledSlot
                    {
                        Task = task,
                        PlannedStart = segment.Start,
                        PlannedEnd = segment.End
                    });
                }

                if (segments.Count > 0)
                {
                    cursor = segments[^1].End;
                }
            }

            return result;
        }

        public List<DeadlineRisk> CheckDeadlineRisks(List<ProductionTask> activeTasks, DateTime now)
        {
            var risks = new List<DeadlineRisk>();

            foreach (var task in activeTasks.Where(t => t.Status != JobStatus.Completed && t.Progress < 0.99))
            {
                var (riskLevel, hoursNeeded, workHoursUntilDeadline) =
                    DeadlineRiskEvaluator.Evaluate(task, now, _workHours);

                if (!DeadlineRiskEvaluator.ShouldShowInBanner(riskLevel, task.Deadline, now))
                    continue;

                var message = BuildRiskMessage(
                    riskLevel,
                    task.Deadline,
                    hoursNeeded,
                    workHoursUntilDeadline);

                risks.Add(new DeadlineRisk
                {
                    TaskId = task.Id,
                    TaskTitle = task.TaskDisplayName,
                    FileName = task.FileName,
                    Deadline = task.Deadline,
                    RequiredHours = hoursNeeded,
                    AvailableHoursBeforeDeadline = workHoursUntilDeadline,
                    RiskLevel = riskLevel,
                    Message = message
                });
            }

            return risks;
        }

        public List<QueueOverloadAlert> CheckQueueOverloads(List<ProductionTask> activeTasks, DateTime now)
        {
            var slots = GetSchedule(activeTasks, now);
            var lastEndByTask = slots
                .GroupBy(s => s.Task.Id)
                .ToDictionary(g => g.Key, g => g.Max(s => s.PlannedEnd));

            var alerts = new List<QueueOverloadAlert>();

            foreach (var task in activeTasks.Where(t => t.Status != JobStatus.Completed && t.Progress < 0.99))
            {
                if (AppDateTime.CompareDeadlineToAppNow(task.Deadline, now) < 0)
                    continue;

                if (!lastEndByTask.TryGetValue(task.Id, out var plannedEnd))
                    continue;

                var deadlineMoscow = AppDateTime.ToMoscowWallClockFromDb(task.Deadline);
                if (plannedEnd <= deadlineMoscow)
                    continue;

                alerts.Add(new QueueOverloadAlert
                {
                    TaskId = task.Id,
                    TaskTitle = task.TaskDisplayName,
                    FileName = task.FileName,
                    EmployeeName = task.EmployeeName,
                    Deadline = task.Deadline,
                    PlannedEnd = plannedEnd,
                    Message =
                        $"В очереди план заканчивается {plannedEnd:dd.MM HH:mm} — позже дедлайна {deadlineMoscow:dd.MM HH:mm}. " +
                        "Пересмотрите нагрузку или сдвиньте дедлайн."
                });
            }

            return alerts;
        }

        private static string BuildRiskMessage(
            string riskLevel,
            DateTime deadline,
            double hoursNeeded,
            double workHoursUntilDeadline)
        {
            return riskLevel switch
            {
                "overdue" =>
                    $"Дедлайн сорван! Задача должна была быть выполнена {deadline:dd.MM HH:mm}",
                "critical" =>
                    BuildCriticalMessage(hoursNeeded, workHoursUntilDeadline),
                "warning" =>
                    $"Внимание! До дедлайна осталось {workHoursUntilDeadline:F1} рабочих ч, требуется {hoursNeeded:F1} ч. Нужно торопиться!",
                _ => ""
            };
        }

        private static string BuildCriticalMessage(double hoursNeeded, double workHoursUntilDeadline)
        {
            var deficit = hoursNeeded - workHoursUntilDeadline;
            var deficitHours = Math.Floor(deficit);
            var deficitMinutes = (deficit % 1) * 60;
            var deficitText = deficitHours > 0
                ? $"{deficitHours} ч {deficitMinutes:F0} мин"
                : $"{deficitMinutes:F0} мин";
            return
                $"Критично! Не хватает {deficitText} рабочих часов до дедлайна. " +
                $"Требуется {hoursNeeded:F1} ч, осталось {workHoursUntilDeadline:F1} ч.";
        }
    }
}
