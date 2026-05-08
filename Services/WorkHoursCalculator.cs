using System;

namespace ProductionPlanner.Services
{
    public class WorkHoursCalculator : IWorkHoursCalculator
    {
        private readonly TimeSpan workStart = new(10, 0, 0);
        private readonly TimeSpan lunchStart = new(14, 0, 0);
        private readonly TimeSpan lunchEnd = new(15, 0, 0);
        private readonly TimeSpan workEnd = new(19, 0, 0);

        public bool IsWorkingHour(DateTime time)
        {
            if (time.DayOfWeek == DayOfWeek.Saturday || time.DayOfWeek == DayOfWeek.Sunday)
                return false;
            var tod = time.TimeOfDay;
            return (tod >= workStart && tod < lunchStart) || (tod >= lunchEnd && tod < workEnd);
        }

        public bool IsLunchTime(DateTime time)
        {
            if (time.DayOfWeek == DayOfWeek.Saturday || time.DayOfWeek == DayOfWeek.Sunday)
                return false;
            var tod = time.TimeOfDay;
            return tod >= lunchStart && tod < lunchEnd;
        }

        public DateTime GetNextWorkStart(DateTime from)
        {
            DateTime next = from;
            while (!IsWorkingHour(next))
            {
                Console.WriteLine($"[WorkHours] {next} - not working hour, incrementing");
                next = next.AddMinutes(1);
            }
            Console.WriteLine($"[WorkHours] Next work start: {next}");
            return next;
        }

        public DateTime AddWorkHours(DateTime start, double hours)
        {
            var current = GetNextWorkStart(start);
            var remaining = hours;
            while (remaining > 0.001)
            {
                if (!IsWorkingHour(current))
                {
                    current = current.AddMinutes(1);
                    continue;
                }
                var endOfBlock = GetEndOfCurrentWorkBlock(current);
                var minutesLeftInBlock = (endOfBlock - current).TotalMinutes;
                var minutesToWork = Math.Min(remaining * 60, minutesLeftInBlock);
                current = current.AddMinutes(minutesToWork);
                remaining -= minutesToWork / 60;
            }
            return current;
        }

        private DateTime GetEndOfCurrentWorkBlock(DateTime time)
        {
            var date = time.Date;
            if (time.TimeOfDay < new TimeSpan(14, 0, 0))
                return date.AddHours(14);
            if (time.TimeOfDay < new TimeSpan(15, 0, 0))
                return date.AddHours(15);
            return date.AddHours(19);
        }

        public double GetWorkHoursBetween(DateTime start, DateTime end)
        {
            if (start >= end) return 0;
            
            double total = 0;
            DateTime current = start;
            
            while (current < end)
            {
                if (current.TimeOfDay >= lunchStart && current.TimeOfDay < lunchEnd)
                {
                    current = current.Date.AddHours(15);
                    continue;
                }
                
                if (IsWorkingHour(current))
                {
                    DateTime next = current.AddMinutes(1);
                    if (next > end) next = end;
                    total += (next - current).TotalHours;
                }
                current = current.AddMinutes(1);
            }
            
            return Math.Round(total, 2);
        }
    }
}