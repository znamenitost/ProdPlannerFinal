using System;

namespace ProductionPlanner.Services
{
    public readonly record struct WorkTimeSegment(DateTime Start, DateTime End);
}
