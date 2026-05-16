using System;
using System.Collections.Generic;

namespace ProductionPlanner.Services
{
    public interface IWorkHoursCalculator
    {
        bool IsWorkingHour(DateTime time);
        bool IsLunchTime(DateTime time);
        DateTime AddWorkHours(DateTime start, double hours);
        IReadOnlyList<WorkTimeSegment> AllocateWorkTime(DateTime start, double hours);
        double GetWorkHoursBetween(DateTime start, DateTime end);
        DateTime GetNextWorkStart(DateTime from);
    }
}