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
                .Where(t => t.Status == JobStatus.Assigned || t.Status == JobStatus.InProgress || t.Status == JobStatus.Paused)
                .OrderBy(t => t.Deadline)
                .ToList();

            var result = new List<ScheduledSlot>();
            var currentTime = _workHours.GetNextWorkStart(now);

            foreach (var task in tasks)
            {
                var remaining = task.EstimateHours * (1 - task.Progress);
                if (remaining <= 0.01) continue;

                double remainingMinutes = remaining * 60;
                var current = currentTime;

                while (remainingMinutes > 0.001)
                {
                    var dayStart = current.Date.AddHours(10);
                    var dayEnd = current.Date.AddHours(19);
                    var lunchStart = current.Date.AddHours(14);
                    var lunchEnd = current.Date.AddHours(15);

                    // Если мы внутри обеда — перескакиваем
                    if (current >= lunchStart && current < lunchEnd)
                    {
                        current = lunchEnd;
                        continue;
                    }

                    DateTime blockEnd;
                    if (current < lunchStart)
                        blockEnd = lunchStart;
                    else if (current >= lunchEnd)
                        blockEnd = dayEnd;
                    else
                        blockEnd = dayEnd; // fallback

                    var minutesAvailable = (blockEnd - current).TotalMinutes;
                    if (minutesAvailable <= 0)
                    {
                        current = _workHours.GetNextWorkStart(current.Date.AddDays(1));
                        continue;
                    }

                    var minutesToAdd = Math.Min(remainingMinutes, minutesAvailable);
                    var segmentEnd = current.AddMinutes(minutesToAdd);
                    result.Add(new ScheduledSlot
                    {
                        Task = task,
                        PlannedStart = current,
                        PlannedEnd = segmentEnd
                    });

                    remainingMinutes -= minutesToAdd;
                    current = segmentEnd;

                    if (remainingMinutes > 0.001 && current >= dayEnd)
                    {
                        current = _workHours.GetNextWorkStart(current.Date.AddDays(1));
                    }
                }
                currentTime = current;
            }

            return result;
        }

        public List<DeadlineRisk> CheckDeadlineRisks(List<ProductionTask> activeTasks, DateTime now)
        {
            var risks = new List<DeadlineRisk>();
            var slots = GetSchedule(activeTasks, now);
            
            foreach (var task in activeTasks.Where(t => t.Status != JobStatus.Completed && t.Progress < 0.99))
            {
                var deadline = task.Deadline;
                var slot = slots.FirstOrDefault(s => s.Task.Id == task.Id);
                if (slot == null) continue;
                
                var hoursNeeded = task.EstimateHours * (1 - task.Progress);
                var workHoursUntilDeadline = _workHours.GetWorkHoursBetween(now, deadline);
                
                string riskLevel = "ok";
                string message = "";
                
                if (deadline < now)
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
                        TaskTitle = task.FileName.Length > 50 ? task.FileName.Substring(0, 50) + "..." : task.FileName,
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