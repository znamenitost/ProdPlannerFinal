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
        private const string WindowsAgentZipName = "ProductionPlanner-FileOpener-win-x64.zip";

        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        public FilesController(IConfiguration configuration, IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _environment = environment;
        }

        [HttpGet("download/windows-agent")]
        public IActionResult DownloadWindowsAgent()
        {
            var zipPath = ResolveWindowsAgentZipPath();
            if (zipPath == null || !System.IO.File.Exists(zipPath))
            {
                return NotFound(new
                {
                    message = "Агент для Windows пока не собран на сервере. Обратитесь к администратору."
                });
            }

            return PhysicalFile(zipPath, "application/zip", WindowsAgentZipName);
        }

        [HttpGet("agent-info")]
        public IActionResult GetAgentInfo()
        {
            var shareName = _configuration["FileOpen:ShareName"] ?? "Клиенты";
            var windowsHost = FilePathNormalizer.GetWindowsServerHost(_configuration["FileOpen:WindowsHost"]);
            var port = _configuration.GetValue("FileOpen:MacOpenerPort", 17888);

            return Ok(new
            {
                port,
                windowsHost,
                shareName,
                agentBaseUrl = $"http://127.0.0.1:{port}",
                downloadUrl = "/api/files/download/windows-agent"
            });
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
            var windowsHost = FilePathNormalizer.GetWindowsServerHost(_configuration["FileOpen:WindowsHost"]);
            var windowsShareName = _configuration["FileOpen:WindowsShareName"] ?? shareName;
            var correctedPath = FilePathNormalizer.NormalizeRelativePath(request.FilePath, shareName);
            var uncPath = FilePathNormalizer.BuildWindowsUncPath(windowsHost, windowsShareName, correctedPath);
            var port = _configuration.GetValue("FileOpen:MacOpenerPort", 17888);

            return Ok(new
            {
                message = "Ссылка на файл сформирована",
                openUrl,
                relativePath = correctedPath,
                uncPath,
                agentOpenUrl = $"http://127.0.0.1:{port}/open?path={Uri.EscapeDataString(uncPath)}",
                launchUrl = $"/api/files/launch?path={Uri.EscapeDataString(request.FilePath)}&clientPlatform={Uri.EscapeDataString(request.ClientPlatform ?? "")}"
            });
        }

        private string? ResolveWindowsAgentZipPath()
        {
            var candidates = new[]
            {
                Path.Combine(_environment.WebRootPath ?? "", "downloads", WindowsAgentZipName),
                Path.Combine(_environment.ContentRootPath, "tools", "ProductionPlanner.FileOpener", "releases", WindowsAgentZipName)
            };

            return candidates.FirstOrDefault(System.IO.File.Exists);
        }

        private bool TryBuildOpenUrl(string filePath, string? clientPlatform, out string openUrl, out string error)
        {
            openUrl = "";
            error = "";

            var shareName = _configuration["FileOpen:ShareName"] ?? "Клиенты";
            var macSmbHost = _configuration["FileOpen:MacSmbHost"] ?? "minimarker";
            var windowsHost = FilePathNormalizer.GetWindowsServerHost(_configuration["FileOpen:WindowsHost"]);
            var netOpenScheme = _configuration["FileOpen:NetOpenScheme"] ?? "netopen";
            var netOpenShareName = _configuration["FileOpen:NetOpenShareName"] ?? shareName;
            var windowsShareName = _configuration["FileOpen:WindowsShareName"] ?? shareName;
            var windowsOpenMode = _configuration["FileOpen:WindowsOpenMode"] ?? "netopen";

            if (!FilePathNormalizer.TryNormalizeRelativePath(filePath, shareName, out var correctedPath, out var pathError))
            {
                error = pathError ?? "Не удалось определить путь к файлу";
                return false;
            }
            if (string.IsNullOrEmpty(correctedPath))
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
