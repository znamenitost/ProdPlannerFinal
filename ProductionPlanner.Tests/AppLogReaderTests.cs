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

    [Fact]
    public void ReadEntries_reads_while_file_is_being_written()
    {
        var path = Path.Combine(Path.GetTempPath(), $"app-log-lock-{Guid.NewGuid():N}.log");
        try
        {
            File.WriteAllText(path, "[2026-06-09T10:00:00.0000000Z] Warning ProductionPlanner.Program: seed\n");

            using var writer = new FileStream(
                path,
                FileMode.Append,
                FileAccess.Write,
                FileShare.ReadWrite);
            using var streamWriter = new StreamWriter(writer) { AutoFlush = true };
            streamWriter.WriteLine("[2026-06-09T10:01:00.0000000Z] Error ProductionPlanner.Program: locked");

            var entries = AppLogReader.ReadEntries(
                path,
                new HashSet<string> { "Warning", "Error" },
                tail: 10);

            Assert.Equal(2, entries.Count);
            Assert.Equal("Error", entries[^1].Level);
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    [Fact]
    public void ReadEntries_reads_tail_without_loading_entire_file()
    {
        var path = Path.Combine(Path.GetTempPath(), $"app-log-tail-{Guid.NewGuid():N}.log");
        try
        {
            var lines = new List<string>
            {
                "[2026-06-09T09:00:00.0000000Z] Information ProductionPlanner.Program: old"
            };
            for (var i = 0; i < 500; i++)
            {
                lines.Add($"[2026-06-09T10:{i % 60:D2}:00.0000000Z] Warning ProductionPlanner.Program: line-{i}");
            }

            File.WriteAllLines(path, lines);

            var entries = AppLogReader.ReadEntries(
                path,
                new HashSet<string> { "Warning" },
                tail: 3);

            Assert.Equal(3, entries.Count);
            Assert.Equal("line-499", entries[^1].Message);
            Assert.DoesNotContain(entries, e => e.Message == "old");
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }
}
