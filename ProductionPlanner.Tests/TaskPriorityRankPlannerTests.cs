using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Tests;

public class TaskPriorityRankPlannerTests
{
    private static List<TaskPriorityRankPlanner.RankedTask> Queue(
        params (int Id, int Rank)[] items) =>
        items.Select(i => new TaskPriorityRankPlanner.RankedTask(i.Id, i.Rank)).ToList();

    [Fact]
    public void VisibleRanks_empty_shows_three_slots()
    {
        Assert.Equal(new[] { 1, 2, 3 }, TaskPriorityRankPlanner.GetVisibleRanks([]));
    }

    [Fact]
    public void VisibleRanks_occupied_1_2_adds_three_next()
    {
        Assert.Equal(
            new[] { 1, 2, 3, 4, 5 },
            TaskPriorityRankPlanner.GetVisibleRanks([1, 2]));
    }

    [Fact]
    public void NextAppendRank_uses_highest_occupied_even_if_there_is_a_gap()
    {
        var ranked = Queue((10, 1), (11, 3), (12, 4));
        Assert.Equal(5, TaskPriorityRankPlanner.NextAppendRank(ranked));
    }

    [Fact]
    public void NextAppendRank_empty_is_1()
    {
        Assert.Equal(1, TaskPriorityRankPlanner.NextAppendRank([]));
    }

    [Fact]
    public void Assign_free_number_to_new_task()
    {
        var ranked = Queue((10, 1), (11, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 12, null, 3);

        Assert.Equal(new Dictionary<int, int?> { [12] = 3 }, changes);
    }

    [Fact]
    public void Assign_occupied_to_new_task_shifts_up()
    {
        var ranked = Queue((10, 1), (11, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 12, null, 1);

        Assert.Equal(1, changes[12]);
        Assert.Equal(2, changes[10]);
        Assert.Equal(3, changes[11]);
    }

    [Fact]
    public void Move_5_to_1_shifts_previous_down()
    {
        var ranked = Queue((1, 1), (2, 2), (3, 3), (4, 4), (5, 5));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 5, 5, 1);

        Assert.Equal(1, changes[5]);
        Assert.Equal(2, changes[1]);
        Assert.Equal(3, changes[2]);
        Assert.Equal(4, changes[3]);
        Assert.Equal(5, changes[4]);
    }

    [Fact]
    public void Move_1_to_3_shifts_2_and_3_up()
    {
        var ranked = Queue((1, 1), (2, 2), (3, 3), (4, 4));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 1, 1, 3);

        Assert.Equal(3, changes[1]);
        Assert.Equal(1, changes[2]);
        Assert.Equal(2, changes[3]);
        Assert.False(changes.ContainsKey(4));
    }

    [Fact]
    public void Move_to_free_number_leaves_others()
    {
        var ranked = Queue((10, 1), (11, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 11, 2, 5);

        Assert.Equal(new Dictionary<int, int?> { [11] = 5 }, changes);
    }

    [Fact]
    public void Clear_only_drops_current()
    {
        var ranked = Queue((10, 1), (11, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 10, 1, null);

        Assert.Equal(new Dictionary<int, int?> { [10] = null }, changes);
    }

    [Fact]
    public void Same_rank_is_noop()
    {
        var ranked = Queue((10, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 10, 2, 2);
        Assert.Empty(changes);
    }

    [Fact]
    public void Join_occupied_does_not_shift_others()
    {
        var ranked = Queue((10, 1), (11, 2));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 12, null, 1, joinWave: true);

        Assert.Equal(new Dictionary<int, int?> { [12] = 1 }, changes);
    }

    [Fact]
    public void Join_move_keeps_the_old_wave()
    {
        var ranked = Queue((10, 1), (11, 2), (12, 3));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 12, 3, 1, joinWave: true);

        Assert.Equal(new Dictionary<int, int?> { [12] = 1 }, changes);
    }

    [Fact]
    public void Join_same_rank_is_noop()
    {
        var ranked = Queue((10, 1), (11, 1));
        var changes = TaskPriorityRankPlanner.PlanAssign(ranked, 11, 1, 1, joinWave: true);
        Assert.Empty(changes);
    }
}
