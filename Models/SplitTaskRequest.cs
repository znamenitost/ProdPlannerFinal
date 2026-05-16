namespace ProductionPlanner.Models
{
    public class SplitTaskRequest
    {
        public int ParentTaskId { get; set; }
        public List<SplitPart> Parts { get; set; } = new();
    }

    public class SplitPart
    {
        public int? ChildTaskId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string TaskType { get; set; } = string.Empty;
        public double AllocatedHours { get; set; }
    }
}