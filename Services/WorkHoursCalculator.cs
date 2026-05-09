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

        /// <summary>
        /// Эффективное вычисление количества рабочих часов между двумя моментами.
        /// Без поминутных циклов, только арифметика по дням.
        /// </summary>
        public double GetWorkHoursBetween(DateTime start, DateTime end)
        {
            if (start >= end) return 0;

            var totalMinutes = 0.0;
            var currentDate = start.Date;
            var endDate = end.Date;

            while (currentDate <= endDate)
            {
                // Выходные пропускаем
                if (currentDate.DayOfWeek != DayOfWeek.Saturday && currentDate.DayOfWeek != DayOfWeek.Sunday)
                {
                    // Определяем границы рабочего дня
                    var dayStart = currentDate + workStart;
                    var dayEnd = currentDate + workEnd;

                    // Интервал для текущего дня с учётом глобальных start/end
                    var intervalStart = start > dayStart ? start : dayStart;
                    var intervalEnd = end < dayEnd ? end : dayEnd;

                    if (intervalStart < intervalEnd)
                    {
                        // Рабочие минуты без учёта обеда
                        var workMinutes = (intervalEnd - intervalStart).TotalMinutes;

                        // Вычитаем обеденное время (14:00-15:00), если оно попадает в интервал
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

        /// <summary>
        /// Добавляет заданное количество рабочих часов к начальному моменту.
        /// Эффективно перебирает дни, не используя поминутные циклы.
        /// </summary>
        public DateTime AddWorkHours(DateTime start, double hours)
        {
            if (hours <= 0) return start;

            var remainingMinutes = hours * 60.0;
            var current = GetNextWorkStart(start);

            while (remainingMinutes > 0.001)
            {
                // Определяем остаток рабочих минут в текущем дне после current
                var date = current.Date;
                var minutesLeftToday = GetRemainingWorkMinutesInDay(current, date);

                if (minutesLeftToday <= 0)
                {
                    // Переход на следующий рабочий день
                    current = GetNextWorkStart(date.AddDays(1));
                    continue;
                }

                var minutesToAdd = Math.Min(remainingMinutes, minutesLeftToday);
                current = current.AddMinutes(minutesToAdd);
                remainingMinutes -= minutesToAdd;

                if (remainingMinutes > 0.001)
                {
                    // Переходим на следующий рабочий день
                    current = GetNextWorkStart(current.Date.AddDays(1));
                }
            }

            return current;
        }

        /// <summary>
        /// Возвращает количество рабочих минут, оставшихся в указанном дне после момента 'current'.
        /// Учитывается только рабочее время (10-14, 15-19), без обеда.
        /// </summary>
        private double GetRemainingWorkMinutesInDay(DateTime current, DateTime day)
        {
            var dayStart = day + workStart;
            var dayEnd = day + workEnd;
            var lunchStartToday = day + lunchStart;
            var lunchEndToday = day + lunchEnd;

            if (current >= dayEnd) return 0;

            var remaining = 0.0;

            // Первый рабочий блок: 10:00 – 14:00
            var block1Start = dayStart;
            var block1End = lunchStartToday;
            if (current < block1End)
            {
                var start = current > block1Start ? current : block1Start;
                if (start < block1End)
                    remaining += (block1End - start).TotalMinutes;
            }

            // Второй рабочий блок: 15:00 – 19:00
            var block2Start = lunchEndToday;
            var block2End = dayEnd;
            if (current < block2End)
            {
                var start = current > block2Start ? current : block2Start;
                if (start < block2End)
                    remaining += (block2End - start).TotalMinutes;
            }

            return remaining;
        }
    }
}