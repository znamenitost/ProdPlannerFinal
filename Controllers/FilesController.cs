using Microsoft.AspNetCore.Mvc;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase
    {
        // Имя или IP Windows ПК с файлами (задай своё)
        private const string SmbHost = "MINIMARKER";
        private const string SmbBase = $"smb://{SmbHost}/Клиенты";

        [HttpPost("open")]
        public IActionResult OpenFile([FromBody] OpenFileRequest request)
        {
            if (string.IsNullOrEmpty(request.FilePath))
                return BadRequest(new { message = "Путь к файлу не указан" });

            var rawPath = request.FilePath.Replace('\\', '/');

            // Если уже smb:// — возвращаем как есть
            if (rawPath.StartsWith("smb://", StringComparison.OrdinalIgnoreCase))
                return Ok(new { downloadUrl = rawPath });

            // Ищем "Клиенты"
            var idx = rawPath.LastIndexOf("Клиенты", StringComparison.OrdinalIgnoreCase);
            if (idx >= 0)
            {
                var relativePath = rawPath.Substring(idx + "Клиенты".Length).TrimStart('/');
                var smbUrl = $"{SmbBase}/{relativePath}";
                return Ok(new { downloadUrl = smbUrl });
            }

            return BadRequest(new { message = "Не удалось определить путь к файлу" });
        }
    }

    public class OpenFileRequest
    {
        public string FilePath { get; set; } = "";
    }
}