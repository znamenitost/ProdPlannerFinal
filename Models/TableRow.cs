// === ./Models/TableRow.cs ===
using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class TableRow
    {
        [Key]
        public int Id { get; set; }
        public int DisplayOrder { get; set; }  // Порядок отображения (0 - самая верхняя)
        public string FolderPath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public string StatusText { get; set; } = string.Empty;
        public DateTime Deadline { get; set; }
        public double EstimateHours { get; set; }
        public string Type { get; set; } = string.Empty;
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // Флаг, что задача была перенесена из Google Sheets
        public bool IsFromGoogleSheets { get; set; } = false;
        
        // НОВОЕ ПОЛЕ: ID родительской задачи (если задача была разделена)
        public int? ParentRowNumber { get; set; }  // null - это корневая задача
    }
}