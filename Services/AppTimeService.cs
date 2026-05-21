using System;

namespace ProductionPlanner.Services
{
    public interface IAppTimeService
    {
        DateTime Now { get; }
        void SetMock(DateTime? mock);
        void ResetMock();
    }

    public class AppTimeService : IAppTimeService
    {
        private static readonly TimeZoneInfo MoscowTimeZone = GetMoscowTimeZone();
        private static DateTime? _mock;

        private static TimeZoneInfo GetMoscowTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Russian Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
            }
        }

        public DateTime Now => _mock ?? TimeZoneInfo.ConvertTime(DateTime.UtcNow, MoscowTimeZone);

        public void SetMock(DateTime? mock) => _mock = mock;

        public void ResetMock() => _mock = null;
    }
}
