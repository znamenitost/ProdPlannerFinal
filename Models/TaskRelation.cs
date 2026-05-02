// === ./Models/TaskRelation.cs ===
using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class TaskRelation
    {
        [Key]
        public int Id { get; set; }
        
        // ID родительской задачи в таблице
        public int ParentTableRowId { get; set; }
        
        // ID дочерней задачи в таблице
        public int ChildTableRowId { get; set; }
        
        // Тип связи (Split - разделение)
        public string RelationType { get; set; } = "Split";
    }
}