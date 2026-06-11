namespace ProductionPlanner.Models;

/// <summary>Фаза задачи «через тест» (одна запись, два этапа по времени).</summary>
public enum TaskWorkPhase
{
    None = 0,
    Test = 1,
    AwaitingApproval = 2,
    Production = 3,
    Done = 4
}
