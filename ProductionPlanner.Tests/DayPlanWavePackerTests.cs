using ProductionPlanner.Services;
using ProductionPlanner.Services.DayPlan;

namespace ProductionPlanner.Tests;

public class DayPlanWavePackerTests
{
    private static readonly DateTime MondayTen = new(2026, 8, 24, 10, 0, 0, DateTimeKind.Unspecified);

    [Fact]
    public void SequentialRanks_startOneAfterAnother()
    {
        var workHours = new WorkHoursCalculator();
        var packed = DayPlanWavePacker.Pack(
            [
                new DayPlanWavePacker.InputTask(1, 1, 2),
                new DayPlanWavePacker.InputTask(2, 2, 3)
            ],
            MondayTen,
            workHours);

        Assert.Equal(2, packed.Count);
        var first = Assert.Single(packed, p => p.TaskId == 1);
        var second = Assert.Single(packed, p => p.TaskId == 2);

        Assert.Equal(MondayTen, first.Segments[0].Start);
        Assert.Equal(MondayTen.AddHours(2), first.Segments[0].End);
        Assert.Equal(MondayTen.AddHours(2), second.Segments[0].Start);
        Assert.Equal(1, first.LaneCount);
        Assert.Equal(1, second.LaneCount);
    }

    [Fact]
    public void SameRank_runInParallel_nextWaveWaitsForLonger()
    {
        var workHours = new WorkHoursCalculator();
        var packed = DayPlanWavePacker.Pack(
            [
                new DayPlanWavePacker.InputTask(1, 1, 2),
                new DayPlanWavePacker.InputTask(2, 1, 5),
                new DayPlanWavePacker.InputTask(3, 2, 1)
            ],
            MondayTen,
            workHours);

        var a = Assert.Single(packed, p => p.TaskId == 1);
        var b = Assert.Single(packed, p => p.TaskId == 2);
        var c = Assert.Single(packed, p => p.TaskId == 3);

        Assert.Equal(MondayTen, a.Segments[0].Start);
        Assert.Equal(MondayTen, b.Segments[0].Start);
        Assert.Equal(2, a.LaneCount);
        Assert.Equal(2, b.LaneCount);
        Assert.NotEqual(a.Lane, b.Lane);

        // Волна 2 после max(2ч, 5ч) = 5ч.
        Assert.Equal(MondayTen.AddHours(5), c.Segments[0].Start);
        Assert.Equal(1, c.LaneCount);
    }

    [Fact]
    public void SameRank_orderControlsLane()
    {
        var packed = DayPlanWavePacker.Pack(
            [
                new DayPlanWavePacker.InputTask(1, 1, 1, 1),
                new DayPlanWavePacker.InputTask(2, 1, 1, 0)
            ],
            MondayTen,
            new WorkHoursCalculator());

        var first = Assert.Single(packed, p => p.Lane == 0);
        var second = Assert.Single(packed, p => p.Lane == 1);
        Assert.Equal(2, first.TaskId);
        Assert.Equal(1, second.TaskId);
    }

    [Fact]
    public void SkipsZeroRemaining()
    {
        var packed = DayPlanWavePacker.Pack(
            [new DayPlanWavePacker.InputTask(1, 1, 0)],
            MondayTen,
            new WorkHoursCalculator());

        Assert.Empty(packed);
    }
}
