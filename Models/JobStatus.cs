namespace ProductionPlanner.Models
{
    public enum JobStatus
    {
        Assigned = 0,
        InProgress = 1,
        Paused = 2,
        Completed = 3,
        /// <summary>Согласование (инфостатус сотрудника).</summary>
        PendingApproval = 4,
        /// <summary>Нет изделий (инфостатус сотрудника).</summary>
        NoItems = 5,
        /// <summary>Согласовано (решение администратора).</summary>
        Approved = 6,
        /// <summary>В наличии (решение администратора).</summary>
        InStock = 7
    }
}
