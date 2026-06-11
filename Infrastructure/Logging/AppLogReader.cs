using System.Text;
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
        // Не читаем весь app.log в память — на проде файл может быть большим и валить воркер IIS (502).
        var lineBudget = Math.Min(50_000, Math.Max(tail * 30, 2_000));
        var lines = ReadLastLines(filePath, lineBudget);
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

    private static List<string> ReadLastLines(string filePath, int maxLines)
    {
        if (maxLines <= 0)
            return [];

        for (var attempt = 0; ; attempt++)
        {
            try
            {
                return ReadLastLinesCore(filePath, maxLines);
            }
            catch (IOException) when (attempt < 2)
            {
                Thread.Sleep(25);
            }
        }
    }

    private static List<string> ReadLastLinesCore(string filePath, int maxLines)
    {
        using var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.ReadWrite);

        if (stream.Length == 0)
            return [];

        var collected = new List<string>(Math.Min(maxLines, 256));
        var current = new List<byte>(256);
        var position = stream.Length;

        while (position > 0 && collected.Count < maxLines)
        {
            position--;
            stream.Seek(position, SeekOrigin.Begin);

            var read = stream.ReadByte();
            if (read < 0)
                break;

            var b = (byte)read;
            if (b == '\n')
            {
                if (current.Count == 0)
                    continue;

                current.Reverse();
                collected.Add(Encoding.UTF8.GetString([.. current]).TrimEnd('\r'));
                current.Clear();
                continue;
            }

            current.Add(b);
        }

        if (current.Count > 0 && collected.Count < maxLines)
        {
            current.Reverse();
            collected.Add(Encoding.UTF8.GetString([.. current]).TrimEnd('\r'));
        }

        collected.Reverse();
        return collected;
    }
}
