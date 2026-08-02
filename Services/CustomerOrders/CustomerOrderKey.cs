using System.Globalization;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services.CustomerOrders;

/// <summary>
/// Ключ заказчика = папка сразу после буквенного указателя:
/// «Клиенты/И/Игорь/Проект» → «Игорь». Вложенные папки проекта заказчика не меняют.
/// </summary>
public static class CustomerOrderKey
{
    public const string DefaultShareName = "Клиенты";

    public static string? TryGetDisplayName(string? folderPath)
    {
        var segments = SplitSegments(folderPath);
        if (segments.Count == 0)
            return null;

        if (segments.Count >= 2 && IsClientLetterSegment(segments[0]))
        {
            var customer = segments[1];
            return string.IsNullOrWhiteSpace(customer) ? null : customer;
        }

        var last = segments[^1];
        return string.IsNullOrWhiteSpace(last) ? null : last;
    }

    public static string? TryGetNormalizedKey(string? folderPath)
    {
        var display = TryGetDisplayName(folderPath);
        return display == null ? null : Normalize(display);
    }

    /// <summary>Буквенный указатель («И» в «Клиенты/И/Игорь») или null, если его нет.</summary>
    public static string? TryGetLetterIndex(string? folderPath)
    {
        var segments = SplitSegments(folderPath);
        return segments.Count > 0 && IsClientLetterSegment(segments[0])
            ? segments[0].ToUpper(CultureInfo.InvariantCulture)
            : null;
    }

    public static bool Matches(string? folderPath, string customerKey) =>
        string.Equals(TryGetNormalizedKey(folderPath), customerKey, StringComparison.Ordinal);

    /// <summary>
    /// Совпадение по правилу «последняя папка пути» — нужно, пока в БД есть записи
    /// CustomerOrderTracking, заведённые по старой семантике ключа.
    /// </summary>
    public static bool LegacyMatches(string? folderPath, string customerKey)
    {
        var segments = SplitSegments(folderPath);
        if (segments.Count == 0)
            return false;

        return string.Equals(Normalize(segments[^1]), customerKey, StringComparison.Ordinal);
    }

    /// <summary>Ключ по старому правилу (последняя папка) — для ленивой переключёвки старых записей.</summary>
    public static string? TryGetLegacyKey(string? folderPath)
    {
        var segments = SplitSegments(folderPath);
        if (segments.Count == 0)
            return null;

        return Normalize(segments[^1]);
    }

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

    /// <summary>
    /// Первичный комментарий из denormalized preview: первый блок без последующих «Автор: …».
    /// </summary>
    public static string ExtractPrimaryComment(string? denormalizedComment)
    {
        var raw = denormalizedComment ?? "";
        if (string.IsNullOrWhiteSpace(raw))
            return "";

        var firstBlock = raw.Contains(TaskCommentService.CommentPreviewSeparator)
            ? raw.Split(TaskCommentService.CommentPreviewSeparator)[0]
            : raw.Split('\n')[0];

        firstBlock = firstBlock.Trim();
        if (string.IsNullOrEmpty(firstBlock))
            return "";

        // «→ Получатель: текст» у baseline
        if (firstBlock.StartsWith('→'))
        {
            var colon = firstBlock.IndexOf(':');
            if (colon > 0 && colon < firstBlock.Length - 1)
                return firstBlock[(colon + 1)..].Trim();
        }

        return firstBlock;
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
