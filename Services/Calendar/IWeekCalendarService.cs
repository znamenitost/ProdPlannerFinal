using ProductionPlanner.Models.Dtos.Calendar;

namespace ProductionPlanner.Services.Calendar;

public interface IWeekCalendarService
{
    Task<WeekCalendarResponseDto> GetWeekAsync(string employee, string? startDate, DateTime currentTime);
}
