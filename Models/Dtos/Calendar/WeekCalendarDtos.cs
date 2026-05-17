namespace ProductionPlanner.Models.Dtos.Calendar;

public class WeekCalendarResponseDto
{
    public DateTime Start { get; set; }
    public List<WeekCalendarDayDto> Days { get; set; } = new();
}

public class WeekCalendarDayDto
{
    public DateTime Date { get; set; }
    public double NetSaved { get; set; }
    public List<CalendarTaskBlockDto> TaskBlocks { get; set; } = new();
    public List<CalendarTimelineSegmentDto> Timeline { get; set; } = new();
    public List<CalendarDeadlineDto> Deadlines { get; set; } = new();
}

public class CalendarTaskBlockDto
{
    public double LeftPercent { get; set; }
    public double WidthPercent { get; set; }
    public double Hours { get; set; }
    public string FullTitle { get; set; } = "";
    public int TaskId { get; set; }
    public string Title { get; set; } = "";
}

public class CalendarTimelineSegmentDto
{
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Type { get; set; } = "";
    public int? TaskId { get; set; }
    public string? TaskTitle { get; set; }
    public bool Completed { get; set; }
    public int Layer { get; set; }
    public int MaxDepth { get; set; }
}

public class CalendarDeadlineDto
{
    public DateTime Deadline { get; set; }
    public string Status { get; set; } = "";
    public double Progress { get; set; }
    public int TaskId { get; set; }
    public string TaskTitle { get; set; } = "";
}
