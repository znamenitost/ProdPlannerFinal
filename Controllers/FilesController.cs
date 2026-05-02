using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase
    {
        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrEmpty(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            try
            {
                // Преобразуем SMB путь обратно в локальный, если это тот же компьютер
                var localPath = ConvertToLocalPath(request.FilePath);
                
                if (System.IO.File.Exists(localPath))
                {
                    if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                    {
                        Process.Start("open", $"\"{localPath}\"");
                        return Ok(new { message = "Файл открыт" });
                    }
                    
                    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = localPath,
                            UseShellExecute = true
                        });
                        return Ok(new { message = "Файл открыт" });
                    }
                }
                
                // Если локального файла нет, пробуем открыть SMB путь
                if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    Process.Start("open", $"\"{request.FilePath}\"");
                    return Ok(new { message = "Файл открыт через SMB" });
                }
                
                return NotFound(new { message = $"Файл не найден: {localPath}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка открытия: {ex.Message}" });
            }
        }
        
        private string ConvertToLocalPath(string smbPath)
        {
            if (string.IsNullOrEmpty(smbPath)) return smbPath;
            
            // Преобразуем smb://MacBook-Air-Pavel.local/Yandex.Disk.localized/... обратно в локальный путь
            if (smbPath.StartsWith("smb://MacBook-Air-Pavel.local/Yandex.Disk.localized"))
            {
                return smbPath.Replace(
                    "smb://MacBook-Air-Pavel.local/Yandex.Disk.localized",
                    "/Users/user/Yandex.Disk.localized"
                );
            }
            
            return smbPath;
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
    }
}