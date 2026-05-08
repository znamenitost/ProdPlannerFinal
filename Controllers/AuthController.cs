using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using System.Security.Claims;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly SignInManager<User> _signInManager;
        private readonly UserManager<User> _userManager;
        private readonly IWebHostEnvironment _environment;
        private readonly IAppTimeService _timeService;

        public AuthController(
            SignInManager<User> signInManager,
            UserManager<User> userManager,
            IWebHostEnvironment environment,
            IAppTimeService timeService)
        {
            _signInManager = signInManager;
            _userManager = userManager;
            _environment = environment;
            _timeService = timeService;
        }

        [HttpPost("login-employee")]
        public async Task<IActionResult> LoginEmployee([FromBody] EmployeeLoginRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.FullName))
            {
                return BadRequest(new { message = "Имя сотрудника обязательно" });
            }

            var user = _userManager.Users.FirstOrDefault(u => u.FullName == request.FullName && u.Role == "Employee");
            
            if (user == null)
            {
                var email = $"{request.FullName.ToLower()}@employee.local";
                user = new User
                {
                    UserName = email,
                    Email = email,
                    FullName = request.FullName,
                    Role = "Employee",
                    IsActive = true,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };
                
                var createResult = await _userManager.CreateAsync(user, "Employee123!");
                if (!createResult.Succeeded)
                {
                    return BadRequest(new { message = "Ошибка создания пользователя" });
                }
                await _userManager.AddToRoleAsync(user, "Employee");
            }

            await _signInManager.SignInAsync(user, isPersistent: false);
            var roles = await _userManager.GetRolesAsync(user);
            
            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                role = roles.FirstOrDefault() ?? "Employee",
                isAuthenticated = true,
                avatarUrl = user.AvatarUrl
            });
        }

        [HttpPost("login-admin")]
        public async Task<IActionResult> LoginAdmin([FromBody] AdminLoginRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Email и пароль обязательны" });
            }

            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return Unauthorized(new { message = "Неверный email или пароль" });
            }

            if (user.Role != "Admin")
            {
                return Unauthorized(new { message = "Доступ только для администраторов" });
            }

            var userName = user.UserName ?? user.Email;
            if (string.IsNullOrEmpty(userName))
            {
                return Unauthorized(new { message = "Ошибка: имя пользователя не найдено" });
            }
            
            var result = await _signInManager.PasswordSignInAsync(userName, request.Password, false, false);
            if (!result.Succeeded)
            {
                return Unauthorized(new { message = "Неверный email или пароль" });
            }

            var roles = await _userManager.GetRolesAsync(user);
            
            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                role = roles.FirstOrDefault() ?? "Admin",
                isAuthenticated = true,
                avatarUrl = user.AvatarUrl
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return Ok(new { message = "Выход выполнен" });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            if (!User.Identity?.IsAuthenticated == true)
            {
                return Unauthorized(new { message = "Не авторизован" });
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден" });
            }

            var roles = await _userManager.GetRolesAsync(user);
            
            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                role = roles.FirstOrDefault() ?? "Employee",
                isAuthenticated = true,
                avatarUrl = user.AvatarUrl
            });
        }

        [HttpPost("upload-avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (!User.Identity?.IsAuthenticated == true)
            {
                return Unauthorized(new { message = "Не авторизован" });
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден" });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "Файл не выбран" });
            }

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Разрешены только изображения (jpg, jpeg, png, gif, webp)" });
            }

            if (file.Length > 2 * 1024 * 1024)
            {
                return BadRequest(new { message = "Размер файла не должен превышать 2MB" });
            }

            var uploadsFolder = Path.Combine(_environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "avatars");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            // Замена AppTime.Now на _timeService.Now
            var fileName = $"{user.Id}_{_timeService.Now.Ticks}{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            
            if (!string.IsNullOrEmpty(user.AvatarUrl))
            {
                var oldFilePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), user.AvatarUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldFilePath))
                {
                    System.IO.File.Delete(oldFilePath);
                }
            }

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            user.AvatarUrl = $"/avatars/{fileName}";
            await _userManager.UpdateAsync(user);

            return Ok(new { avatarUrl = user.AvatarUrl, message = "Аватар загружен" });
        }

        [HttpGet("avatar/{userId}")]
        public async Task<IActionResult> GetAvatar(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null || string.IsNullOrEmpty(user.AvatarUrl))
            {
                return NotFound();
            }
            
            var filePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), user.AvatarUrl.TrimStart('/'));
            if (!System.IO.File.Exists(filePath))
            {
                return NotFound();
            }
            
            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
            var contentType = GetContentType(Path.GetExtension(filePath));
            return File(fileBytes, contentType);
        }

        [HttpDelete("avatar")]
        public async Task<IActionResult> DeleteAvatar()
        {
            if (!User.Identity?.IsAuthenticated == true)
            {
                return Unauthorized(new { message = "Не авторизован" });
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден" });
            }

            if (!string.IsNullOrEmpty(user.AvatarUrl))
            {
                var filePath = Path.Combine(_environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), user.AvatarUrl.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
                
                user.AvatarUrl = null;
                await _userManager.UpdateAsync(user);
            }

            return Ok(new { message = "Аватар удалён" });
        }

        private string GetContentType(string extension)
        {
            return extension.ToLower() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };
        }

        // Метод init-users оставляем на случай ручного вызова, но использование AppTime в нём не было
        // (там только DateTime.UtcNow, что корректно). Оставляем без изменений.
        [HttpPost("init-users")]
        public async Task<IActionResult> InitUsers()
        {
            // Создаём администратора Павел
            var pavelEmail = "pavel@admin.com";
            var pavelUser = await _userManager.FindByEmailAsync(pavelEmail);
            if (pavelUser == null)
            {
                pavelUser = new User
                {
                    UserName = pavelEmail,
                    Email = pavelEmail,
                    FullName = "Павел",
                    Role = "Admin",
                    IsActive = true,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };
                await _userManager.CreateAsync(pavelUser, "Admin123!");
                await _userManager.AddToRoleAsync(pavelUser, "Admin");
            }

            // Создаём сотрудника Дима
            var dimaUser = _userManager.Users.FirstOrDefault(u => u.FullName == "Дима");
            if (dimaUser == null)
            {
                dimaUser = new User
                {
                    UserName = "dima@employee.local",
                    Email = "dima@employee.local",
                    FullName = "Дима",
                    Role = "Employee",
                    IsActive = true,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };
                await _userManager.CreateAsync(dimaUser, "Employee123!");
                await _userManager.AddToRoleAsync(dimaUser, "Employee");
            }

            // Создаём сотрудника Яромир
            var yaromerUser = _userManager.Users.FirstOrDefault(u => u.FullName == "Яромир");
            if (yaromerUser == null)
            {
                yaromerUser = new User
                {
                    UserName = "yaromer@employee.local",
                    Email = "yaromer@employee.local",
                    FullName = "Яромир",
                    Role = "Employee",
                    IsActive = true,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };
                await _userManager.CreateAsync(yaromerUser, "Employee123!");
                await _userManager.AddToRoleAsync(yaromerUser, "Employee");
            }

            return Ok(new { message = "Пользователи инициализированы" });
        }
    }

    public class EmployeeLoginRequest
    {
        public string FullName { get; set; } = string.Empty;
    }

    public class AdminLoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}