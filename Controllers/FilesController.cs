using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase
    {
        private const string SmbHost = "MINIMARKER";      // Имя или IP Windows-ПК в сети
        private const string ShareName = "Клиенты";       // Имя расшаренной папки

        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrEmpty(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            var rawPath = request.FilePath.Replace('\\', '/');
            
            var clientIdx = rawPath.LastIndexOf(ShareName, StringComparison.OrdinalIgnoreCase);
            if (clientIdx < 0)
                return BadRequest(new { message = "Не удалось определить путь к файлу" });

            // Относительный путь после "Клиенты"
            var relativePath = rawPath.Substring(clientIdx + ShareName.Length).TrimStart('/');
            var parts = relativePath.Split('/');
            var cleanFileName = parts[parts.Length - 1].Split('[')[0].Trim();
            
            // Добавляем расширение, если его нет
            if (!cleanFileName.EndsWith(".cdr") && 
                !cleanFileName.EndsWith(".ai") && 
                !cleanFileName.EndsWith(".pdf") &&
                !cleanFileName.EndsWith(".eps"))
            {
                cleanFileName += ".cdr";
            }
            
            parts[parts.Length - 1] = cleanFileName;
            var correctedPath = string.Join("/", parts);
            
            // macOS формат: smb://MINIMARKER/Клиенты/...
            var smbUrl = $"smb://{SmbHost}/{ShareName}/{correctedPath}";
            
            // Windows формат: \\MINIMARKER\Клиенты\...
            var uncPath = $@"\\{SmbHost}\{ShareName}\{correctedPath.Replace("/", "\\")}";
            
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    // macOS: открываем через open
                    Process.Start("open", $"\"{smbUrl}\"");
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    // Windows: используем explorer с UNC-путём
                    // Экранируем пробелы и спецсимволы
                    var args = $"/c start \"\" \"{uncPath}\"";
                    Process.Start("cmd.exe", args);
                }
                else
                {
                    // Linux: просто возвращаем ссылку
                    return Ok(new { downloadUrl = smbUrl });
                }
                
                return Ok(new { message = "Файл открывается", downloadUrl = smbUrl, uncPath });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка: {ex.Message}", downloadUrl = smbUrl, uncPath });
            }
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
    }
}