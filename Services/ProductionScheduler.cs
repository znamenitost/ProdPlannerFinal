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
            // Все активные задачи (в работе или назначенные) сортируем по дедлайну от ближайшего к дальнему
            var tasks = activeTasks
                .Where(t => t.Status == JobStatus.Assigned || t.Status == JobStatus.InProgress)
                .OrderBy(t => t.Deadline)
                .ToList();

            var slots = new List<ScheduledSlot>();
            var currentStart = _workHours.GetNextWorkStart(now);

            foreach (var task in tasks)
            {
                // Пропускаем lunch
                while (_workHours.IsLunchTime(currentStart))
                {
                    currentStart = currentStart.AddMinutes(1);
                }

                var remaining = task.EstimateHours * (1 - task.Progress);
                if (remaining <= 0.01) continue;

                var start = currentStart;
                var end = _workHours.AddWorkHours(start, remaining);
                slots.Add(new ScheduledSlot { Task = task, PlannedStart = start, PlannedEnd = end });
                currentStart = end;
            }

            return slots;
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
                    message = $"❌ Дедлайн сорван! Задача должна была быть выполнена {deadline:dd.MM HH:mm}";
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
                    message = $"🔴 Критично! Не хватает {deficitText} рабочих часов до дедлайна. Требуется {hoursNeeded:F1} ч, осталось {workHoursUntilDeadline:F1} ч.";
                }
                else if (workHoursUntilDeadline < hoursNeeded + 2)
                {
                    riskLevel = "warning";
                    message = $"🟡 Внимание! До дедлайна осталось {workHoursUntilDeadline:F1} рабочих ч, требуется {hoursNeeded:F1} ч. Нужно торопиться!";
                }
                
                if (riskLevel != "ok")
                {
                    risks.Add(new DeadlineRisk
                    {
                        TaskId = task.Id,
                        TaskTitle = task.Title.Length > 50 ? task.Title.Substring(0, 50) + "..." : task.Title,
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