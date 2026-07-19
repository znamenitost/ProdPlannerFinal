using System.Text.RegularExpressions;

namespace ProductionPlanner.Services;

public static class FilePathNormalizer
{
    /// <summary>Имя ПК в локальной сети для Windows (UNC / netopen / file://). IP не используем — может меняться.</summary>
    public const string WindowsServerHostName = "MINIMARKER";

    private static readonly Regex DrivePrefixRegex = new(@"^[A-Za-z]:[/\\]?", RegexOptions.Compiled);

    /// <summary>Хост для открытия файлов с Windows. Пустое значение → имя по умолчанию.</summary>
    public static string GetWindowsServerHost(string? configuredHost = null) =>
        string.IsNullOrWhiteSpace(configuredHost)
            ? WindowsServerHostName
            : configuredHost.Trim().Trim('\\', '/');

    /// <summary>
    /// Возвращает путь относительно SMB-шары «Клиенты»: Ф/Фрэшмемори/файл.cdr
    /// </summary>
    public static string NormalizeRelativePath(string filePath, string shareName)
    {
        return TryNormalizeRelativePath(filePath, shareName, out var relativePath, out _)
            ? relativePath ?? string.Empty
            : string.Empty;
    }

    public static bool TryNormalizeRelativePath(
        string filePath,
        string shareName,
        out string? relativePath,
        out string? error)
    {
        return TryNormalizeRelativePathCore(filePath, shareName, appendFileExtension: true, out relativePath, out error);
    }

    /// <summary>
    /// Путь к папке относительно шары «Клиенты» (без дописывания .cdr).
    /// </summary>
    public static string NormalizeRelativeFolderPath(string folderPath, string shareName)
    {
        return TryNormalizeRelativeFolderPath(folderPath, shareName, out var relativePath, out _)
            ? relativePath ?? string.Empty
            : string.Empty;
    }

    public static bool TryNormalizeRelativeFolderPath(
        string folderPath,
        string shareName,
        out string? relativePath,
        out string? error)
    {
        return TryNormalizeRelativePathCore(folderPath, shareName, appendFileExtension: false, out relativePath, out error);
    }

    private static bool TryNormalizeRelativePathCore(
        string filePath,
        string shareName,
        bool appendFileExtension,
        out string? relativePath,
        out string? error)
    {
        relativePath = null;
        error = null;

        if (string.IsNullOrWhiteSpace(filePath))
        {
            error = appendFileExtension ? "Путь к файлу не указан" : "Путь к папке не указан";
            return false;
        }

        var rawPath = filePath.Replace('\\', '/').Trim();
        if (rawPath.StartsWith('/') || rawPath.StartsWith('\\'))
        {
            error = "Недопустимый путь";
            return false;
        }

        while (rawPath.Contains("//", StringComparison.Ordinal))
            rawPath = rawPath.Replace("//", "/", StringComparison.Ordinal);

        rawPath = rawPath.Trim('/');
        rawPath = DrivePrefixRegex.Replace(rawPath, "");

        var sharePrefix = shareName.Trim('/');
        var shareMarker = sharePrefix + "/";
        var shareIndex = rawPath.IndexOf(shareMarker, StringComparison.OrdinalIgnoreCase);
        if (shareIndex >= 0)
            rawPath = rawPath[(shareIndex + shareMarker.Length)..];
        else if (rawPath.Equals(sharePrefix, StringComparison.OrdinalIgnoreCase))
            rawPath = string.Empty;

        rawPath = rawPath.Trim('/');
        if (string.IsNullOrEmpty(rawPath))
        {
            error = appendFileExtension
                ? "Не удалось определить путь к файлу"
                : "Не удалось определить путь к папке";
            return false;
        }

        var parts = rawPath
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();

        if (parts.Length == 0)
        {
            error = appendFileExtension
                ? "Не удалось определить путь к файлу"
                : "Не удалось определить путь к папке";
            return false;
        }

        foreach (var part in parts)
        {
            if (part is "." or "..")
            {
                error = "Недопустимый путь";
                return false;
            }
        }

        if (appendFileExtension)
        {
            var cleanFileName = parts[^1].Split('[')[0].Trim();
            if (!HasSupportedExtension(cleanFileName))
                cleanFileName += ".cdr";

            parts[^1] = cleanFileName;
        }

        var joined = string.Join("/", parts);
        // Для папки (один сегмент) передаём путь как hint, иначе буква-каталог не добавится.
        relativePath = appendFileExtension
            ? EnsureClientLetterPrefix(joined)
            : EnsureClientLetterPrefix(joined, joined);
        return true;
    }

    /// <summary>
    /// Дополняет путь буквой-каталогом после «Клиенты», если указан без неё
    /// (например «Федерация Бодибилдинга/файл.cdr» → «Ф/Федерация Бодибилдинга/файл.cdr»).
    /// </summary>
    internal static string EnsureClientLetterPrefix(string relativePath, string? folderPathHint = null)
    {
        var parts = relativePath
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
            return relativePath;

        if (IsClientLetterSegment(parts[0]))
            return string.Join("/", parts);

        var folderOnly = !string.IsNullOrWhiteSpace(folderPathHint)
            ? folderPathHint.Trim().Trim('/').Replace('\\', '/')
            : parts.Length > 1
                ? string.Join("/", parts[..^1])
                : "";

        if (string.IsNullOrEmpty(folderOnly) && parts.Length == 1)
            return string.Join("/", parts);

        var letterSource = !string.IsNullOrEmpty(folderOnly) ? folderOnly : parts[0];
        var letter = letterSource.FirstOrDefault(char.IsLetter);
        if (letter == default)
            return string.Join("/", parts);

        return $"{letter}/{string.Join("/", parts)}";
    }

    private static bool IsClientLetterSegment(string segment) =>
        segment.Length == 1 && char.IsLetter(segment[0]);

    /// <summary>
    /// Абсолютный путь на Mac: /Volumes/Клиенты/Ф/.../file.cdr (для команды open).
    /// </summary>
    public static string? BuildMacLocalPath(string? volumeMountPath, string relativePath)
    {
        if (string.IsNullOrWhiteSpace(volumeMountPath))
            return null;

        var basePath = volumeMountPath.Trim().TrimEnd('/');
        var path = relativePath.Replace('\\', '/').Trim('/');
        if (string.IsNullOrEmpty(path))
            return null;

        return $"{basePath}/{path}";
    }

    /// <summary>
    /// file:///Volumes/Клиенты/... — запасной вариант (браузер часто открывает только папку).
    /// </summary>
    public static string? BuildMacFileUrl(string? volumeMountPath, string relativePath)
    {
        var localPath = BuildMacLocalPath(volumeMountPath, relativePath);
        if (localPath == null)
            return null;

        if (!Uri.TryCreate(localPath, UriKind.Absolute, out var uri))
            return null;

        return uri.AbsoluteUri;
    }

    public static string BuildSmbUrl(string host, string shareName, string relativePath, bool encodePath = true)
    {
        var normalizedHost = (host ?? "minimarker").Trim().ToLowerInvariant();
        var share = shareName.Trim('/');
        var path = relativePath.Replace('\\', '/').Trim('/');

        if (!encodePath)
            return $"smb://{normalizedHost}/{share}/{path}";

        var encodedShare = Uri.EscapeDataString(share);
        var encodedPath = string.Join("/",
            path.Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => Uri.EscapeDataString(s)));

        return $"smb://{normalizedHost}/{encodedShare}/{encodedPath}";
    }

    public static string BuildNetOpenUrl(string scheme, string host, string shareName, string relativePath)
    {
        var path = relativePath.Replace('\\', '/').Trim('/');
        var encodedPath = EncodePathSegments(path);
        return $"{scheme.TrimEnd(':')}://{host.Trim()}/{shareName.Trim('/')}/{encodedPath}";
    }

    /// <summary>
    /// file://server/Share/path — открытие с Windows через сетевую шару (без netopen).
    /// </summary>
    public static string BuildWindowsFileUrl(string host, string shareName, string relativePath)
    {
        var path = relativePath.Replace('\\', '/').Trim('/');
        var encodedPath = EncodePathSegments(path);
        var share = Uri.EscapeDataString(shareName.Trim('/'));
        return $"file://{host.Trim()}/{share}/{encodedPath}";
    }

    /// <summary>
    /// \\server\Share\path — для справки и тестов в проводнике.
    /// </summary>
    public static string BuildWindowsUncPath(string host, string shareName, string relativePath)
    {
        var path = relativePath.Replace('/', '\\').Trim('\\');
        return $@"\\{host.Trim()}\{shareName.Trim('\\')}\{path}";
    }

    private static string EncodePathSegments(string path) =>
        string.Join("/",
            path.Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(Uri.EscapeDataString));

    private static bool HasSupportedExtension(string fileName) =>
        fileName.EndsWith(".cdr", StringComparison.OrdinalIgnoreCase)
        || fileName.EndsWith(".ai", StringComparison.OrdinalIgnoreCase)
        || fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
        || fileName.EndsWith(".eps", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Задача подходит для превью .cdr: имя нормализуется как при открытии файла
    /// (дописывается .cdr, если расширения нет; .ai/.pdf/.eps — не CDR).
    /// </summary>
    public static bool IsEligibleForCdrPreview(string? folderPath, string? fileName, string shareName = "Клиенты")
    {
        var trimmedName = (fileName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmedName))
            return false;

        var folder = (folderPath ?? string.Empty).Trim().TrimEnd('/', '\\').Replace('\\', '/');
        var combined = string.IsNullOrEmpty(folder) ? trimmedName : $"{folder}/{trimmedName}";

        if (!TryNormalizeRelativePath(combined, shareName, out var relativePath, out _)
            || string.IsNullOrEmpty(relativePath))
            return false;

        var file = relativePath.Split('/').LastOrDefault() ?? string.Empty;
        return file.EndsWith(".cdr", StringComparison.OrdinalIgnoreCase);
    }
}
