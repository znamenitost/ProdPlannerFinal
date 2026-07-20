using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;
using ProductionPlanner.Services.AppSettings;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private const string WindowsAgentZipName = "ProductionPlanner-FileOpener-win-x64.zip";
        private const string PrintAgentZipName = "ProductionPlanner-PrintAgent-win.zip";

        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly IFileOpenSettingsService _fileOpenSettings;

        public FilesController(
            IConfiguration configuration,
            IWebHostEnvironment environment,
            IFileOpenSettingsService fileOpenSettings)
        {
            _configuration = configuration;
            _environment = environment;
            _fileOpenSettings = fileOpenSettings;
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

        [HttpGet("download/print-agent")]
        public IActionResult DownloadPrintAgent()
        {
            var zipPath = ResolvePrintAgentZipPath();
            if (zipPath == null || !System.IO.File.Exists(zipPath))
            {
                return NotFound(new
                {
                    message = "Агент печати пока не собран на сервере. Обратитесь к администратору."
                });
            }

            return PhysicalFile(zipPath, "application/zip", PrintAgentZipName);
        }

        [HttpGet("agent-info")]
        public async Task<IActionResult> GetAgentInfo(CancellationToken cancellationToken)
        {
            var settings = await _fileOpenSettings.GetAsync(cancellationToken);
            var port = _configuration.GetValue("FileOpen:MacOpenerPort", 17888);

            return Ok(new
            {
                port,
                windowsHost = settings.WindowsHost,
                shareName = settings.ShareName,
                macSmbHost = settings.MacSmbHost,
                agentBaseUrl = $"http://127.0.0.1:{port}",
                downloadUrl = "/api/files/download/windows-agent",
                printAgentDownloadUrl = "/api/files/download/print-agent"
            });
        }

        [HttpGet("launch")]
        public async Task<IActionResult> LaunchFile(
            [FromQuery] string path,
            [FromQuery] string? clientPlatform,
            [FromQuery] bool isDirectory = false,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest(new { message = isDirectory ? "Путь к папке не указан" : "Путь к файлу не указан" });

            var settings = await _fileOpenSettings.GetAsync(cancellationToken);
            if (!TryBuildOpenUrl(path, clientPlatform, isDirectory, settings, out var openUrl, out var error))
                return BadRequest(new { message = error });

            return Redirect(openUrl);
        }

        [HttpPost("open")]
        public async Task<IActionResult> OpenFile(
            [FromBody] OpenFileRequest request,
            CancellationToken cancellationToken = default)
        {
            var isDirectory = request.IsDirectory;
            if (string.IsNullOrWhiteSpace(request.FilePath))
                return BadRequest(new { message = isDirectory ? "Путь к папке не указан" : "Путь к файлу не указан" });

            var settings = await _fileOpenSettings.GetAsync(cancellationToken);
            if (!TryBuildOpenUrl(request.FilePath, request.ClientPlatform, isDirectory, settings, out var openUrl, out var error))
                return BadRequest(new { message = error });

            var shareName = settings.ShareName;
            var windowsHost = FilePathNormalizer.GetWindowsServerHost(settings.WindowsHost);
            var correctedPath = isDirectory
                ? FilePathNormalizer.NormalizeRelativeFolderPath(request.FilePath, shareName)
                : FilePathNormalizer.NormalizeRelativePath(request.FilePath, shareName);
            var uncPath = FilePathNormalizer.BuildWindowsUncPath(windowsHost, shareName, correctedPath);
            var port = _configuration.GetValue("FileOpen:MacOpenerPort", 17888);

            return Ok(new
            {
                message = isDirectory ? "Ссылка на папку сформирована" : "Ссылка на файл сформирована",
                openUrl,
                relativePath = correctedPath,
                uncPath,
                agentOpenUrl = $"http://127.0.0.1:{port}/open?path={Uri.EscapeDataString(uncPath)}",
                launchUrl = $"/api/files/launch?path={Uri.EscapeDataString(request.FilePath)}&clientPlatform={Uri.EscapeDataString(request.ClientPlatform ?? "")}&isDirectory={(isDirectory ? "true" : "false")}"
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

        private string? ResolvePrintAgentZipPath()
        {
            var candidates = new[]
            {
                Path.Combine(_environment.WebRootPath ?? "", "downloads", PrintAgentZipName),
                Path.Combine(_environment.ContentRootPath, "tools", "ProductionPlanner.PrintAgent", "releases", PrintAgentZipName)
            };

            return candidates.FirstOrDefault(System.IO.File.Exists);
        }

        private bool TryBuildOpenUrl(
            string filePath,
            string? clientPlatform,
            bool isDirectory,
            FileOpenSettingsDto settings,
            out string openUrl,
            out string error)
        {
            openUrl = "";
            error = "";

            var shareName = settings.ShareName;
            var macSmbHost = settings.MacSmbHost;
            var windowsHost = FilePathNormalizer.GetWindowsServerHost(settings.WindowsHost);
            var netOpenScheme = _configuration["FileOpen:NetOpenScheme"] ?? "netopen";
            var windowsOpenMode = _configuration["FileOpen:WindowsOpenMode"] ?? "netopen";

            string? correctedPath;
            string? pathError;
            var normalized = isDirectory
                ? FilePathNormalizer.TryNormalizeRelativeFolderPath(filePath, shareName, out correctedPath, out pathError)
                : FilePathNormalizer.TryNormalizeRelativePath(filePath, shareName, out correctedPath, out pathError);
            if (!normalized)
            {
                error = pathError ?? (isDirectory
                    ? "Не удалось определить путь к папке"
                    : "Не удалось определить путь к файлу");
                return false;
            }
            if (string.IsNullOrEmpty(correctedPath))
            {
                error = isDirectory
                    ? "Не удалось определить путь к папке"
                    : "Не удалось определить путь к файлу";
                return false;
            }

            var platform = clientPlatform ?? "";
            var isWindows = platform.Contains("Win", StringComparison.OrdinalIgnoreCase)
                || platform.Contains("Windows", StringComparison.OrdinalIgnoreCase);

            if (isWindows)
            {
                openUrl = windowsOpenMode.Equals("netopen", StringComparison.OrdinalIgnoreCase)
                    ? FilePathNormalizer.BuildNetOpenUrl(netOpenScheme, windowsHost, shareName, correctedPath)
                    : FilePathNormalizer.BuildWindowsFileUrl(windowsHost, shareName, correctedPath);
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
        public bool IsDirectory { get; set; }
    }
}
