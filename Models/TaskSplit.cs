using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class TaskSplit
    {
        [Key]
        public int Id { get; set; }
        
        // ID родительской задачи (из Google Sheets)
        public int ParentRowNumber { get; set; }
        
        // ID дочерней задачи в нашей системе
        public int ChildTaskId { get; set; }
        
        // Сотрудник, которому назначена дочерняя задача
        public string AssignedTo { get; set; } = string.Empty;
        
        // Тип задачи (Резка или УФ печать)
        public string SplitType { get; set; } = string.Empty;
        
        // Выделенное время на эту часть
        public double AllocatedHours { get; set; }

        /// <summary>Порядок этапа в последовательной задаче (1, 2, 3…).</summary>
        public int SequenceOrder { get; set; }

        /// <summary>Тестовая часть пары «через согласование».</summary>
        public bool IsApprovalTestPart { get; set; }

        /// <summary>Дочерняя задача-тест, после согласования которой разблокируется эта часть.</summary>
        public int? ApprovalGateTestChildId { get; set; }
        
        // Связь с задачей
        public ProductionTask ChildTask { get; set; } = null!;
    }
}