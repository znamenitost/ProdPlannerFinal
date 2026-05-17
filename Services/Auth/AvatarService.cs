using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services.Auth;

public class AvatarService : IAvatarService
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    private readonly UserManager<User> _userManager;
    private readonly IWebHostEnvironment _environment;
    private readonly IAppTimeService _timeService;

    public AvatarService(
        UserManager<User> userManager,
        IWebHostEnvironment environment,
        IAppTimeService timeService)
    {
        _userManager = userManager;
        _environment = environment;
        _timeService = timeService;
    }

    public async Task<string> UploadAsync(User user, IFormFile file)
    {
        if (file.Length == 0)
            throw new ArgumentException("Файл не выбран");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new ArgumentException("Разрешены только изображения (jpg, jpeg, png, gif, webp)");

        if (file.Length > 2 * 1024 * 1024)
            throw new ArgumentException("Размер файла не должен превышать 2MB");

        var uploadsFolder = GetAvatarsFolder();
        Directory.CreateDirectory(uploadsFolder);

        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            var oldFilePath = MapWebPath(user.AvatarUrl);
            if (File.Exists(oldFilePath))
                File.Delete(oldFilePath);
        }

        var fileName = $"{user.Id}_{_timeService.Now.Ticks}{extension}";
        var filePath = Path.Combine(uploadsFolder, fileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        user.AvatarUrl = $"/avatars/{fileName}";
        await _userManager.UpdateAsync(user);

        return user.AvatarUrl;
    }

    public async Task DeleteAsync(User user)
    {
        if (string.IsNullOrEmpty(user.AvatarUrl))
            return;

        var filePath = MapWebPath(user.AvatarUrl);
        if (File.Exists(filePath))
            File.Delete(filePath);

        user.AvatarUrl = null;
        await _userManager.UpdateAsync(user);
    }

    public async Task<(byte[] Bytes, string ContentType)?> GetFileAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null || string.IsNullOrEmpty(user.AvatarUrl))
            return null;

        var filePath = MapWebPath(user.AvatarUrl);
        if (!File.Exists(filePath))
            return null;

        var fileBytes = await File.ReadAllBytesAsync(filePath);
        var contentType = GetContentType(Path.GetExtension(filePath));
        return (fileBytes, contentType);
    }

    private string GetAvatarsFolder() =>
        Path.Combine(WebRootPath, "avatars");

    private string WebRootPath =>
        _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

    private string MapWebPath(string avatarUrl) =>
        Path.Combine(WebRootPath, avatarUrl.TrimStart('/'));

    private static string GetContentType(string extension) => extension.ToLower() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        _ => "application/octet-stream"
    };
}
