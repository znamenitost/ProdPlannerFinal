using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public FilesController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            var shareName = _configuration["FileOpen:ShareName"] ?? "Клиенты";
            var macSmbHost = _configuration["FileOpen:MacSmbHost"] ?? "MINIMARKER";
            var windowsHost = _configuration["FileOpen:WindowsHost"] ?? "192.168.1.119";
            var netOpenScheme = _configuration["FileOpen:NetOpenScheme"] ?? "netopen";
            var netOpenShareName = _configuration["FileOpen:NetOpenShareName"] ?? shareName.ToLowerInvariant();

            var correctedPath = NormalizeRelativePath(request.FilePath, shareName);
            if (string.IsNullOrWhiteSpace(correctedPath))
                return BadRequest(new { message = "Не удалось определить путь к файлу" });

            var smbUrl = $"smb://{macSmbHost}/{shareName}/{correctedPath}";
            var netOpenUrl = $"{netOpenScheme}://{windowsHost}/{netOpenShareName}/{correctedPath}";
            var clientPlatform = request.ClientPlatform ?? string.Empty;
            var downloadUrl = clientPlatform.Contains("Win", StringComparison.OrdinalIgnoreCase)
                ? netOpenUrl
                : smbUrl;

            return Ok(new
            {
                message = "Ссылка на файл сформирована",
                downloadUrl,
                smbUrl,
                netOpenUrl
            });
        }

        private static string NormalizeRelativePath(string filePath, string shareName)
        {
            var rawPath = filePath.Replace('\\', '/').Trim();
            while (rawPath.Contains("//"))
                rawPath = rawPath.Replace("//", "/");

            rawPath = rawPath.Trim('/');
            var sharePrefix = shareName.Trim('/');
            if (rawPath.StartsWith(sharePrefix + "/", StringComparison.OrdinalIgnoreCase))
                rawPath = rawPath[(sharePrefix.Length + 1)..];

            var parts = rawPath
                .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToArray();

            if (parts.Length == 0)
                return string.Empty;

            var cleanFileName = parts[^1].Split('[')[0].Trim();
            if (!HasSupportedExtension(cleanFileName))
                cleanFileName += ".cdr";

            parts[^1] = cleanFileName;
            return string.Join("/", parts);
        }

        private static bool HasSupportedExtension(string fileName)
        {
            return fileName.EndsWith(".cdr", StringComparison.OrdinalIgnoreCase)
                || fileName.EndsWith(".ai", StringComparison.OrdinalIgnoreCase)
                || fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
                || fileName.EndsWith(".eps", StringComparison.OrdinalIgnoreCase);
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
        public string? ClientPlatform { get; set; }
    }
}