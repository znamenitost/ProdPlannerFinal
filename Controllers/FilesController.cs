using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ProductionPlanner.Services;

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

        [HttpGet("launch")]
        public IActionResult LaunchFile([FromQuery] string path, [FromQuery] string? clientPlatform)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest(new { message = "Путь к файлу не указан" });

            if (!TryBuildOpenUrl(path, clientPlatform, out var openUrl, out var error))
                return BadRequest(new { message = error });

            return Redirect(openUrl);
        }

        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            if (!TryBuildOpenUrl(request.FilePath, request.ClientPlatform, out var openUrl, out var error))
                return BadRequest(new { message = error });

            var shareName = _configuration["FileOpen:ShareName"] ?? "Клиенты";
            var correctedPath = FilePathNormalizer.NormalizeRelativePath(request.FilePath, shareName);

            return Ok(new
            {
                message = "Ссылка на файл сформирована",
                openUrl,
                relativePath = correctedPath,
                launchUrl = $"/api/files/launch?path={Uri.EscapeDataString(request.FilePath)}&clientPlatform={Uri.EscapeDataString(request.ClientPlatform ?? "")}"
            });
        }

        private bool TryBuildOpenUrl(string filePath, string? clientPlatform, out string openUrl, out string error)
        {
            openUrl = "";
            error = "";

            var shareName = _configuration["FileOpen:ShareName"] ?? "Клиенты";
            var macSmbHost = _configuration["FileOpen:MacSmbHost"] ?? "minimarker";
            var windowsHost = _configuration["FileOpen:WindowsHost"] ?? "192.168.1.119";
            var netOpenScheme = _configuration["FileOpen:NetOpenScheme"] ?? "netopen";
            var netOpenShareName = _configuration["FileOpen:NetOpenShareName"] ?? shareName;
            var windowsShareName = _configuration["FileOpen:WindowsShareName"] ?? shareName;
            var windowsOpenMode = _configuration["FileOpen:WindowsOpenMode"] ?? "file";

            var correctedPath = FilePathNormalizer.NormalizeRelativePath(filePath, shareName);
            if (string.IsNullOrWhiteSpace(correctedPath))
            {
                error = "Не удалось определить путь к файлу";
                return false;
            }

            var platform = clientPlatform ?? "";
            var isWindows = platform.Contains("Win", StringComparison.OrdinalIgnoreCase)
                || platform.Contains("Windows", StringComparison.OrdinalIgnoreCase);

            if (isWindows)
            {
                openUrl = windowsOpenMode.Equals("netopen", StringComparison.OrdinalIgnoreCase)
                    ? FilePathNormalizer.BuildNetOpenUrl(netOpenScheme, windowsHost, netOpenShareName, correctedPath)
                    : FilePathNormalizer.BuildWindowsFileUrl(windowsHost, windowsShareName, correctedPath);
            }
            else
            {
                // Кодирование каждого сегмента (запятые в имени файла — иначе открывается только папка).
                openUrl = FilePathNormalizer.BuildSmbUrl(macSmbHost, shareName, correctedPath, encodePath: true);
            }

            return true;
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
        public string? ClientPlatform { get; set; }
    }
}
