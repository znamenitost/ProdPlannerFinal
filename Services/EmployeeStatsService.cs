using System.Collections.Concurrent;
using ProductionPlanner.Data;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public interface IEmployeeStatsService
    {
        Task AddSavedHoursAsync(string employeeName, double savedHours, DateTime now);
        Task<double> GetTodaySavedHoursAsync(string employeeName, DateTime now);
        Task ResetTodayIfNeededAsync(string employeeName, DateTime now);
    }

    public class EmployeeStatsService : IEmployeeStatsService
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> StatLocks = new();
        private readonly IProductionTaskRepository _repo;

        public EmployeeStatsService(IProductionTaskRepository repo, IAppTimeService timeService)
        {
            _repo = repo;
        }

        public async Task AddSavedHoursAsync(string employeeName, double savedHours, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(employeeName))
                return;

            var sem = StatLocks.GetOrAdd(employeeName, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync();
            try
            {
                var stat = await _repo.GetEmployeeStatAsync(employeeName);
                if (stat == null)
                {
                    stat = new EmployeeStat
                    {
                        EmployeeName = employeeName,
                        TotalSavedHours = savedHours,
                        TodaySavedHours = savedHours,
                        LastResetDate = now.Date
                    };
                    await _repo.UpdateEmployeeStatAsync(stat);
                    return;
                }

                ApplyResetIfNeeded(stat, now);
                stat.TotalSavedHours += savedHours;
                stat.TodaySavedHours += savedHours;
                await _repo.UpdateEmployeeStatAsync(stat);
            }
            finally
            {
                sem.Release();
            }
        }

        public async Task<double> GetTodaySavedHoursAsync(string employeeName, DateTime now)
        {
            var stat = await _repo.GetEmployeeStatAsync(employeeName);
            if (stat == null) return 0;

            if (NeedsDayReset(stat, now))
            {
                ApplyResetIfNeeded(stat, now);
                await _repo.UpdateEmployeeStatAsync(stat);
            }

            return stat.TodaySavedHours;
        }

        public async Task ResetTodayIfNeededAsync(string employeeName, DateTime now)
        {
            var stat = await _repo.GetEmployeeStatAsync(employeeName);
            if (stat == null || !NeedsDayReset(stat, now)) return;

            ApplyResetIfNeeded(stat, now);
            await _repo.UpdateEmployeeStatAsync(stat);
        }

        private static bool NeedsDayReset(EmployeeStat stat, DateTime now) =>
            stat.LastResetDate.Date != now.Date;

        private static void ApplyResetIfNeeded(EmployeeStat stat, DateTime now)
        {
            if (!NeedsDayReset(stat, now)) return;
            stat.TodaySavedHours = 0;
            stat.LastResetDate = now.Date;
        }
    }
}
