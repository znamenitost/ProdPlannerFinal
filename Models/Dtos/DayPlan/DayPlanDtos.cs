namespace ProductionPlanner.Models.Dtos.DayPlan;

public class DayPlanResponseDto
{
    public DateTime Date { get; set; }
    public DateTime CurrentTime { get; set; }
    public DateTime DayStart { get; set; }
    public DateTime DayEnd { get; set; }
    public double PlannedHoursToday { get; set; }
    public double TailHours { get; set; }
    public DateTime? TailUntil { get; set; }
    public int MaxParallel { get; set; }
    public List<DayPlanLunchDto> LunchIntervals { get; set; } = [];
    public List<DayPlanWaveDto> Waves { get; set; } = [];
    public List<DayPlanTaskDto> Unplanned { get; set; } = [];
}

public class DayPlanLunchDto
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double TopPercent { get; set; }
    public double HeightPercent { get; set; }
}

public class DayPlanWaveDto
{
    public int Rank { get; set; }
    public int LaneCount { get; set; }
    public double? TopPercent { get; set; }
    public double? HeightPercent { get; set; }
    public List<DayPlanBlockDto> Blocks { get; set; } = [];
    public List<DayPlanTaskDto> Blocked { get; set; } = [];
}

public class DayPlanBlockDto
{
    public int TaskId { get; set; }
    public int Rank { get; set; }
    public int Lane { get; set; }
    public int LaneCount { get; set; }
    public double TopPercent { get; set; }
    public double HeightPercent { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public double Hours { get; set; }
    public DayPlanTaskDto Task { get; set; } = new();
}

public class DayPlanTaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string FolderPath { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Type { get; set; } = "";
    public string StatusText { get; set; } = "";
    public int Status { get; set; }
    public int? PriorityRank { get; set; }
    public double RemainingHours { get; set; }
    public DateTime? Deadline { get; set; }
    public bool IsSplitTask { get; set; }
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.Never)]
    public int? ParentRowNumber { get; set; }
    public int SupplyMode { get; set; }
    public int SequenceOrder { get; set; }
    public bool SequenceStartBlocked { get; set; }
    public bool Blocked { get; set; }
    public bool IsFuss { get; set; }
    public bool HasCdrPreview { get; set; }
    public string Comment { get; set; } = "";
    public List<string> PartnerNames { get; set; } = [];
}
