using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;
using System;
using System.Collections.Generic;
using System.Linq;

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
            var slots = GetSchedule(activeTasks, now);
            var firstSlotByTaskId = slots
                .GroupBy(s => s.Task.Id)
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var task in activeTasks.Where(t => t.Status != JobStatus.Completed && t.Progress < 0.99))
            {
                var deadline = task.Deadline;
                if (!firstSlotByTaskId.TryGetValue(task.Id, out var slot))
                    continue;
                
                var hoursNeeded = task.EstimateHours * (1 - task.Progress);
                var deadlineMoscow = AppDateTime.ToMoscowWallClockFromDb(deadline);
                var workHoursUntilDeadline = _workHours.GetWorkHoursBetween(slot.PlannedStart, deadlineMoscow);

                string riskLevel = "ok";
                string message = "";

                if (AppDateTime.CompareDeadlineToAppNow(deadline, now) < 0)
                {
                    riskLevel = "overdue";
                    message = $"Дедлайн сорван! Задача должна была быть выполнена {deadline:dd.MM HH:mm}";
                }
                else if (workHoursUntilDeadline < hoursNeeded)
                {
                    riskLevel = "critical";
                    var deficit = hoursNeeded - workHoursUntilDeadline;
                    var deficitHours = Math.Floor(deficit);
                    var deficitMinutes = (deficit % 1) * 60;
                    var deficitText = deficitHours > 0 
                        ? $"{deficitHours} ч {deficitMinutes:F0} мин" 
                        : $"{deficitMinutes:F0} мин";
                    message = $"Критично! Не хватает {deficitText} рабочих часов до дедлайна. Требуется {hoursNeeded:F1} ч, осталось {workHoursUntilDeadline:F1} ч.";
                }
                else if (workHoursUntilDeadline < hoursNeeded + 2)
                {
                    riskLevel = "warning";
                    message = $"Внимание! До дедлайна осталось {workHoursUntilDeadline:F1} рабочих ч, требуется {hoursNeeded:F1} ч. Нужно торопиться!";
                }
                
                if (riskLevel != "ok")
                {
                    risks.Add(new DeadlineRisk
                    {
                        TaskId = task.Id,
                        TaskTitle = task.TaskDisplayName,
                        FileName = task.FileName,
                        Deadline = deadline,
                        RequiredHours = hoursNeeded,
                        AvailableHoursBeforeDeadline = workHoursUntilDeadline,
                        RiskLevel = riskLevel,
                        Message = message
                    });
                }
            }
            
            return risks;
        }
    }
}
