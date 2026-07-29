using Microsoft.Extensions.Logging.Abstractions;
using ProductionPlanner.Data;

namespace ProductionPlanner.Tests;

public class PostCommitOutboxTests
{
    [Fact]
    public async Task EnqueueOrRunAsync_runs_immediately_without_scope()
    {
        var outbox = new PostCommitOutbox(NullLogger<PostCommitOutbox>.Instance);
        var ran = false;

        await outbox.EnqueueOrRunAsync(() =>
        {
            ran = true;
            return Task.CompletedTask;
        });

        Assert.True(ran);
    }

    [Fact]
    public async Task EnqueueOrRunAsync_defers_until_Flush_inside_scope()
    {
        var outbox = new PostCommitOutbox(NullLogger<PostCommitOutbox>.Instance);
        var order = new List<string>();

        using (outbox.BeginScope())
        {
            await outbox.EnqueueOrRunAsync(() =>
            {
                order.Add("a");
                return Task.CompletedTask;
            });
            await outbox.EnqueueOrRunAsync(() =>
            {
                order.Add("b");
                return Task.CompletedTask;
            });

            Assert.Empty(order);

            await outbox.FlushAsync();
            Assert.Equal(["a", "b"], order);
        }
    }

    [Fact]
    public async Task Dispose_scope_without_Flush_discards_actions()
    {
        var outbox = new PostCommitOutbox(NullLogger<PostCommitOutbox>.Instance);
        var ran = false;

        using (outbox.BeginScope())
        {
            await outbox.EnqueueOrRunAsync(() =>
            {
                ran = true;
                return Task.CompletedTask;
            });
        }

        await outbox.FlushAsync();
        Assert.False(ran);
    }

    [Fact]
    public async Task Nested_scope_restores_outer_after_dispose()
    {
        var outbox = new PostCommitOutbox(NullLogger<PostCommitOutbox>.Instance);
        var order = new List<string>();

        using (outbox.BeginScope())
        {
            await outbox.EnqueueOrRunAsync(() =>
            {
                order.Add("outer");
                return Task.CompletedTask;
            });

            using (outbox.BeginScope())
            {
                await outbox.EnqueueOrRunAsync(() =>
                {
                    order.Add("inner");
                    return Task.CompletedTask;
                });
                await outbox.FlushAsync();
            }

            Assert.Equal(["inner"], order);

            await outbox.FlushAsync();
            Assert.Equal(["inner", "outer"], order);
        }
    }

    [Fact]
    public async Task FlushAsync_continues_after_action_failure()
    {
        var outbox = new PostCommitOutbox(NullLogger<PostCommitOutbox>.Instance);
        var secondRan = false;

        using (outbox.BeginScope())
        {
            await outbox.EnqueueOrRunAsync(() => throw new InvalidOperationException("boom"));
            await outbox.EnqueueOrRunAsync(() =>
            {
                secondRan = true;
                return Task.CompletedTask;
            });

            await outbox.FlushAsync();
        }

        Assert.True(secondRan);
    }
}
