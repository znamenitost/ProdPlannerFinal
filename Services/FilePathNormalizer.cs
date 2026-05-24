using System.Text.RegularExpressions;

namespace ProductionPlanner.Services;

public static class FilePathNormalizer
{
    private static readonly Regex DrivePrefixRegex = new(@"^[A-Za-z]:[/\\]?", RegexOptions.Compiled);

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
        relativePath = null;
        error = null;

        if (string.IsNullOrWhiteSpace(filePath))
        {
            error = "Путь к файлу не указан";
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
            error = "Не удалось определить путь к файлу";
            return false;
        }

        var parts = rawPath
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();

        if (parts.Length == 0)
        {
            error = "Не удалось определить путь к файлу";
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

        var cleanFileName = parts[^1].Split('[')[0].Trim();
        if (!HasSupportedExtension(cleanFileName))
            cleanFileName += ".cdr";

        parts[^1] = cleanFileName;
        relativePath = string.Join("/", parts);
        return true;
    }

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
}
