using System;
using System.Collections.Generic;

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
                else if (tod >= lunchStart && tod < lunchEnd)
                    t = t.Date + lunchEnd;
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

                        var lunchStartToday = currentDate + lunchStart;
                        var lunchEndToday = currentDate + lunchEnd;

                        if (intervalStart < lunchEndToday && intervalEnd > lunchStartToday)
                        {
                            var lunchOverlapStart = intervalStart > lunchStartToday ? intervalStart : lunchStartToday;
                            var lunchOverlapEnd = intervalEnd < lunchEndToday ? intervalEnd : lunchEndToday;
                            workMinutes -= (lunchOverlapEnd - lunchOverlapStart).TotalMinutes;
                        }

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
            var dayStart = day + workStart;
            var dayEnd = day + workEnd;
            var lunchStartToday = day + lunchStart;
            var lunchEndToday = day + lunchEnd;

            if (current >= dayEnd) return 0;

            if (current < lunchStartToday)
            {
                return (lunchStartToday - current).TotalMinutes;
            }
            else if (current >= lunchEndToday && current < dayEnd)
            {
                return (dayEnd - current).TotalMinutes;
            }
            return 0;
        }
    }
}