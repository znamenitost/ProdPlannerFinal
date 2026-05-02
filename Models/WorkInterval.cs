using System.ComponentModel.DataAnnotations;

namespace ProductionPlanner.Models
{
    public class WorkInterval
    {
        [Key]
        public int Id { get; set; }
        public int ProductionTaskId { get; set; }
        public ProductionTask Task { get; set; } = null!;
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }
}