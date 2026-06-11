using System.Text.RegularExpressions;

namespace ProductionPlanner.Infrastructure.Logging;

public sealed record AppLogEntry(
    string Timestamp,
    string Level,
    string Category,
    string Message,
    IReadOnlyList<string> Details);

public static class AppLogReader
{
    private static readonly Regex HeaderLine = new(
        @"^\[(?<ts>[^\]]+)\]\s+(?<level>Trace|Debug|Information|Warning|Error|Critical)\s+(?<cat>[^:]+):\s*(?<msg>.*)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static IReadOnlyList<AppLogEntry> ReadEntries(
        string filePath,
        IReadOnlySet<string>? levels = null,
        int tail = 500)
    {
        if (!File.Exists(filePath))
            return [];

        tail = Math.Clamp(tail, 1, 5000);
        var lines = File.ReadAllLines(filePath);
        var entries = ParseLines(lines);

        if (levels is { Count: > 0 })
        {
            entries = entries
                .Where(e => levels.Contains(e.Level))
                .ToList();
        }

        if (entries.Count <= tail)
            return entries;

        return entries.Skip(entries.Count - tail).ToList();
    }

    internal static List<AppLogEntry> ParseLines(IEnumerable<string> lines)
    {
        var entries = new List<AppLogEntry>();
        AppLogEntry? current = null;
        var details = new List<string>();

        void Flush()
        {
            if (current == null) return;
            entries.Add(current with { Details = details.ToList() });
            current = null;
            details.Clear();
        }

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(line))
                continue;

            var match = HeaderLine.Match(line);
            if (match.Success)
            {
                Flush();
                current = new AppLogEntry(
                    match.Groups["ts"].Value,
                    match.Groups["level"].Value,
                    match.Groups["cat"].Value.Trim(),
                    match.Groups["msg"].Value,
                    []);
            }
            else if (current != null)
            {
                details.Add(line);
            }
        }

        Flush();
        return entries;
    }
}
