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
        private readonly IProductionTaskRepository _repo;
        private readonly IAppTimeService _timeService;

        public EmployeeStatsService(IProductionTaskRepository repo, IAppTimeService timeService)
        {
            _repo = repo;
            _timeService = timeService;
        }

        public async Task AddSavedHoursAsync(string employeeName, double savedHours, DateTime now)
        {
            var stat = await _repo.GetEmployeeStatAsync(employeeName);
            if (stat == null)
            {
                stat = new EmployeeStat
                {
                    EmployeeName = employeeName,
                    TotalSavedHours = 0,
                    TodaySavedHours = 0,
                    LastResetDate = now.Date
                };
            }

            await ResetTodayIfNeededAsync(employeeName, now);

            stat.TotalSavedHours += savedHours;
            stat.TodaySavedHours += savedHours;
            await _repo.UpdateEmployeeStatAsync(stat);
        }

        public async Task<double> GetTodaySavedHoursAsync(string employeeName, DateTime now)
        {
            var stat = await _repo.GetEmployeeStatAsync(employeeName);
            if (stat == null) return 0;
            await ResetTodayIfNeededAsync(employeeName, now);
            return stat.TodaySavedHours;
        }

        public async Task ResetTodayIfNeededAsync(string employeeName, DateTime now)
        {
            var stat = await _repo.GetEmployeeStatAsync(employeeName);
            if (stat == null) return;

            if (stat.LastResetDate.Date != now.Date)
            {
                stat.TodaySavedHours = 0;
                stat.LastResetDate = now.Date;
                await _repo.UpdateEmployeeStatAsync(stat);
            }
        }
    }
}