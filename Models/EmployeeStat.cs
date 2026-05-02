namespace ProductionPlanner.Models
{
    public class EmployeeStat
    {
        public int Id { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public double TotalSavedHours { get; set; }
        public double TodaySavedHours { get; set; }
        public DateTime LastResetDate { get; set; }
    }
}