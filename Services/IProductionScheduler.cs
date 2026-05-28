using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface IProductionScheduler
    {
        List<ScheduledSlot> GetSchedule(List<ProductionTask> activeTasks, DateTime now);
        List<DeadlineRisk> CheckDeadlineRisks(List<ProductionTask> activeTasks, DateTime now);
        List<QueueOverloadAlert> CheckQueueOverloads(List<ProductionTask> activeTasks, DateTime now);
    }

    public class ScheduledSlot
    {
        public ProductionTask Task { get; set; } = null!;
        public DateTime PlannedStart { get; set; }
        public DateTime PlannedEnd { get; set; }
    }

    public class DeadlineRisk
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; } = "";
        public string FileName { get; set; } = "";
        public DateTime Deadline { get; set; }
        public double RequiredHours { get; set; }
        public double AvailableHoursBeforeDeadline { get; set; }
        public string RiskLevel { get; set; } = "";
        public string Message { get; set; } = "";
    }
}