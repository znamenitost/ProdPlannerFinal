using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase
    {
        private const string SmbHost = "MINIMARKER";
        private const string ShareName = "Клиенты";

        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrEmpty(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            var rawPath = request.FilePath.Replace('\\', '/');
            
            var clientIdx = rawPath.LastIndexOf(ShareName, StringComparison.OrdinalIgnoreCase);
            if (clientIdx < 0)
                return BadRequest(new { message = "Не удалось определить путь к файлу" });

            var relativePath = rawPath.Substring(clientIdx + ShareName.Length).TrimStart('/');
            
            var parts = relativePath.Split('/');
            var cleanFileName = parts[parts.Length - 1].Split('[')[0].Trim();
            
            if (!cleanFileName.EndsWith(".cdr") && 
                !cleanFileName.EndsWith(".ai") && 
                !cleanFileName.EndsWith(".pdf") &&
                !cleanFileName.EndsWith(".eps"))
            {
                cleanFileName += ".cdr";
            }
            
            parts[parts.Length - 1] = cleanFileName;
            var correctedPath = string.Join("/", parts);
            
            var smbUrl = $"smb://{SmbHost}/{ShareName}/{correctedPath}";
            
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    // Открываем SMB-ссылку через open (macOS откроет Finder или приложение по умолчанию)
                    Process.Start("open", $"\"{smbUrl}\"");
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = smbUrl,
                        UseShellExecute = true
                    });
                }
                
                return Ok(new { message = "Файл открывается", downloadUrl = smbUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка: {ex.Message}", downloadUrl = smbUrl });
            }
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
    }
}