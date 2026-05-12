using System;
using System.Threading;

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
        private static readonly AsyncLocal<DateTime?> _mockDateTime = new();
        private static DateTime? _globalMock;

        private static TimeZoneInfo GetMoscowTimeZone()
        {
            try
            {
                // Windows
                return TimeZoneInfo.FindSystemTimeZoneById("Russian Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                // Linux / macOS
                return TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
            }
        }

        public DateTime Now
        {
            get
            {
                if (_mockDateTime.Value.HasValue)
                    return _mockDateTime.Value.Value;
                if (_globalMock.HasValue)
                    return _globalMock.Value;
                
                // Всегда возвращаем московское время (преобразуем UTC+0 в UTC+3)
                return TimeZoneInfo.ConvertTime(DateTime.UtcNow, MoscowTimeZone);
            }
        }

        public void SetMock(DateTime? mock)
        {
            _globalMock = mock;
            _mockDateTime.Value = mock;
        }

        public void ResetMock()
        {
            _globalMock = null;
            _mockDateTime.Value = null;
        }
    }
}