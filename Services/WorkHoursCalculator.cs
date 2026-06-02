using System;
using System.Collections.Generic;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services
{
    public class WorkHoursCalculator : IWorkHoursCalculator
    {
        private readonly TimeSpan workStart = new(10, 0, 0);
        private readonly TimeSpan workEnd = new(19, 0, 0);

        public bool IsWorkingHour(DateTime time)
        {
            if (time.DayOfWeek == DayOfWeek.Saturday || time.DayOfWeek == DayOfWeek.Sunday)
                return false;
            var tod = time.TimeOfDay;
            return tod >= workStart && tod < workEnd;
        }

        public bool IsLunchTime(DateTime time)
        {
            return false;
        }

        public DateTime GetNextWorkStart(DateTime from)
        {
            var t = from;
            if (t.DayOfWeek == DayOfWeek.Saturday)
                t = t.Date.AddDays(2).Add(workStart);
            else if (t.DayOfWeek == DayOfWeek.Sunday)
                t = t.Date.AddDays(1).Add(workStart);
            else
            {
                var tod = t.TimeOfDay;
                if (tod < workStart)
                    t = t.Date + workStart;
                else if (tod >= workEnd)
                    t = t.Date.AddDays(1).Add(workStart);
            }
            if (t.DayOfWeek == DayOfWeek.Saturday || t.DayOfWeek == DayOfWeek.Sunday)
                return GetNextWorkStart(t);
            return t;
        }

        public double GetWorkHoursBetween(DateTime start, DateTime end)
        {
            if (start >= end) return 0;

            var totalMinutes = 0.0;
            var currentDate = start.Date;
            var endDate = end.Date;

            while (currentDate <= endDate)
            {
                if (currentDate.DayOfWeek != DayOfWeek.Saturday && currentDate.DayOfWeek != DayOfWeek.Sunday)
                {
                    var dayStart = currentDate + workStart;
                    var dayEnd = currentDate + workEnd;

                    var intervalStart = start > dayStart ? start : dayStart;
                    var intervalEnd = end < dayEnd ? end : dayEnd;

                    if (intervalStart < intervalEnd)
                    {
                        var workMinutes = (intervalEnd - intervalStart).TotalMinutes;
                        totalMinutes += Math.Max(0, workMinutes);
                    }
                }
                currentDate = currentDate.AddDays(1);
            }

            return Math.Round(totalMinutes / 60.0, 2);
        }

        public DateTime AddWorkHours(DateTime start, double hours)
        {
            if (hours <= 0) return start;

            var segments = AllocateWorkTime(start, hours);
            return segments.Count > 0 ? segments[^1].End : GetNextWorkStart(start);
        }

        public IReadOnlyList<WorkTimeSegment> AllocateWorkTime(DateTime start, double hours)
        {
            if (hours <= 0) return Array.Empty<WorkTimeSegment>();

            var segments = new List<WorkTimeSegment>();
            var remainingMinutes = hours * 60.0;
            var current = GetNextWorkStart(start);

            while (remainingMinutes > 0.001)
            {
                var minutesLeftInBlock = GetRemainingWorkMinutesInDay(current, current.Date);
                if (minutesLeftInBlock <= 0)
                {
                    current = GetNextWorkStart(current.Date.AddDays(1));
                    continue;
                }

                var minutesToAdd = Math.Min(remainingMinutes, minutesLeftInBlock);
                var segmentEnd = current.AddMinutes(minutesToAdd);
                segments.Add(new WorkTimeSegment(current, segmentEnd));

                remainingMinutes -= minutesToAdd;
                current = segmentEnd;

                if (remainingMinutes > 0.001)
                {
                    current = GetNextWorkStart(current);
                }
            }

            return segments;
        }

        private double GetRemainingWorkMinutesInDay(DateTime current, DateTime day)
        {
            var dayEnd = day + workEnd;

            if (current >= dayEnd) return 0;

            return (dayEnd - current).TotalMinutes;
        }
    }
}