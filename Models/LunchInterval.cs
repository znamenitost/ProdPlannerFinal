using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class LunchInterval
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(100)]
        public string EmployeeName { get; set; } = string.Empty;

        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }
}
