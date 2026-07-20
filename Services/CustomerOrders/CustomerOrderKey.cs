using System.Globalization;

namespace ProductionPlanner.Services.CustomerOrders;

/// <summary>Ключ заказчика = последняя папка в пути после шары «Клиенты».</summary>
public static class CustomerOrderKey
{
    public const string DefaultShareName = "Клиенты";

    public static string? TryGetDisplayName(string? folderPath)
    {
        var segments = SplitSegments(folderPath);
        if (segments.Count == 0)
            return null;

        var last = segments[^1];
        return string.IsNullOrWhiteSpace(last) ? null : last;
    }

    public static string? TryGetNormalizedKey(string? folderPath)
    {
        var display = TryGetDisplayName(folderPath);
        return display == null ? null : Normalize(display);
    }

    public static bool Matches(string? folderPath, string customerKey) =>
        string.Equals(TryGetNormalizedKey(folderPath), customerKey, StringComparison.Ordinal);

    public static string Normalize(string displayName) =>
        displayName.Trim().ToLowerInvariant();

    /// <summary>Буква каталога после «Клиенты» (А, Ф, …) или первая буква имени заказчика.</summary>
    public static char ResolvePickupLetter(string? folderPath, string customerDisplayName)
    {
        var segments = SplitSegments(folderPath);
        if (segments.Count > 0 && IsClientLetterSegment(segments[0]))
            return char.ToUpper(segments[0][0], CultureInfo.InvariantCulture);

        var letterSource = !string.IsNullOrWhiteSpace(customerDisplayName)
            ? customerDisplayName
            : segments.FirstOrDefault() ?? "X";
        var letter = letterSource.FirstOrDefault(char.IsLetter);
        return letter == default
            ? 'X'
            : char.ToUpper(letter, CultureInfo.InvariantCulture);
    }

    public static string BuildOrderTitle(string? fileName, string? comment, string customerDisplayName)
    {
        var parts = new List<string>(2);
        var file = StripExtension((fileName ?? "").Trim());
        if (!string.IsNullOrEmpty(file))
            parts.Add(file);

        var c = (comment ?? "").Trim();
        if (!string.IsNullOrEmpty(c))
            parts.Add(c);

        if (parts.Count > 0)
            return string.Join(" — ", parts);

        return string.IsNullOrWhiteSpace(customerDisplayName) ? "Заказ" : customerDisplayName.Trim();
    }

    private static string StripExtension(string fileName)
    {
        if (string.IsNullOrEmpty(fileName))
            return "";
        var ext = Path.GetExtension(fileName);
        return string.IsNullOrEmpty(ext) ? fileName : fileName[..^ext.Length];
    }

    private static List<string> SplitSegments(string? folderPath)
    {
        if (string.IsNullOrWhiteSpace(folderPath))
            return [];

        var parts = folderPath
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        if (parts.Count > 0
            && parts[0].Equals(DefaultShareName, StringComparison.OrdinalIgnoreCase))
        {
            parts.RemoveAt(0);
        }

        return parts;
    }

    private static bool IsClientLetterSegment(string segment) =>
        segment.Length == 1 && char.IsLetter(segment[0]);
}
