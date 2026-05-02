using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class ProductionTask
    {
        [Key]
        public int Id { get; set; }
        public int RowNumber { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string File { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public DateTime Deadline { get; set; }
        public double EstimateHours { get; set; }
        public JobStatus Status { get; set; }
        public double Progress { get; set; }
        public double ActualHours { get; set; }
        public DateTime? CompletedAt { get; set; }
        public List<WorkInterval> WorkIntervals { get; set; } = new();
        
        // Поля для уведомлений (добавить)
        public bool Notified { get; set; } = false;
        public bool OverdueNotified { get; set; } = false;
        
        // Новые поля для разделения задач
        public int? ParentRowNumber { get; set; }  // Если не null, это дочерняя задача
        public bool IsSplitTask { get; set; } = false;  // Является ли результат разделения
        
        // Навигационное свойство для дочерних задач
        public List<TaskSplit> ChildSplits { get; set; } = new();
    }
}