using ProductionPlanner.Infrastructure.Logging;

namespace ProductionPlanner.Tests;

public class AppLogReaderTests
{
    [Fact]
    public void ReadEntries_groups_stack_trace_and_filters_levels()
    {
        var path = Path.Combine(Path.GetTempPath(), $"app-log-test-{Guid.NewGuid():N}.log");
        try
        {
            File.WriteAllLines(path,
            [
                "[2026-06-09T10:00:00.0000000Z] Error ProductionPlanner.Controllers.Foo: boom",
                "   at ProductionPlanner.Services.Bar()",
                "[2026-06-09T10:01:00.0000000Z] Warning ProductionPlanner.Hubs.Hub: reconnect",
                "[2026-06-09T10:02:00.0000000Z] Information ProductionPlanner.Program: started",
            ]);

            var warningsOnly = AppLogReader.ReadEntries(
                path,
                new HashSet<string> { "Warning" },
                tail: 100);

            Assert.Single(warningsOnly);
            Assert.Equal("Warning", warningsOnly[0].Level);

            var errorsOnly = AppLogReader.ReadEntries(
                path,
                new HashSet<string> { "Error" },
                tail: 100);

            Assert.Single(errorsOnly);
            Assert.Single(errorsOnly[0].Details);
            Assert.Contains("Bar", errorsOnly[0].Details[0]);
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }
}
