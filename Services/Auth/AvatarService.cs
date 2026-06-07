using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace ProductionPlanner.Services.Auth;

public class AvatarService : IAvatarService
{
    private const int ThumbnailSize = 128;
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

    private readonly UserManager<User> _userManager;
    private readonly IWebHostEnvironment _environment;
    private readonly IAppTimeService _timeService;
    private readonly ILoginEmployeesBootstrapService _loginEmployeesBootstrap;

    public AvatarService(
        UserManager<User> userManager,
        IWebHostEnvironment environment,
        IAppTimeService timeService,
        ILoginEmployeesBootstrapService loginEmployeesBootstrap)
    {
        _userManager = userManager;
        _environment = environment;
        _timeService = timeService;
        _loginEmployeesBootstrap = loginEmployeesBootstrap;
    }

    public async Task<string> UploadAsync(User user, IFormFile file)
    {
        if (file.Length == 0)
            throw new ArgumentException("Файл не выбран");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new ArgumentException("Разрешены только изображения (jpg, jpeg, png, gif, webp, svg)");

        if (file.Length > 2 * 1024 * 1024)
            throw new ArgumentException("Размер файла не должен превышать 2MB");

        var uploadsFolder = GetAvatarsFolder();
        Directory.CreateDirectory(uploadsFolder);

        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            var oldFilePath = MapWebPath(user.AvatarUrl);
            if (File.Exists(oldFilePath))
                File.Delete(oldFilePath);

            var oldThumbPath = GetThumbnailPath(user.Id);
            if (File.Exists(oldThumbPath))
                File.Delete(oldThumbPath);
        }

        var fileName = $"{user.Id}_{_timeService.Now.Ticks}{extension}";
        var filePath = Path.Combine(uploadsFolder, fileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        if (!IsSvg(filePath))
            await SaveThumbnailAsync(filePath, GetThumbnailPath(user.Id));

        user.AvatarUrl = $"/avatars/{fileName}";
        await _userManager.UpdateAsync(user);
        await _loginEmployeesBootstrap.RefreshAsync();

        return user.AvatarUrl;
    }

    public async Task DeleteAsync(User user)
    {
        if (string.IsNullOrEmpty(user.AvatarUrl))
            return;

        var filePath = MapWebPath(user.AvatarUrl);
        if (File.Exists(filePath))
            File.Delete(filePath);

        var thumbPath = GetThumbnailPath(user.Id);
        if (File.Exists(thumbPath))
            File.Delete(thumbPath);

        user.AvatarUrl = null;
        await _userManager.UpdateAsync(user);
        await _loginEmployeesBootstrap.RefreshAsync();
    }

    public async Task<(byte[] Bytes, string ContentType)?> GetFileAsync(string userId, int? maxWidth = null)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null || string.IsNullOrEmpty(user.AvatarUrl))
            return null;

        var filePath = MapWebPath(user.AvatarUrl);
        if (!File.Exists(filePath))
            return null;

        var useThumbnail = maxWidth.HasValue && maxWidth.Value <= ThumbnailSize && !IsSvg(filePath);
        if (useThumbnail)
        {
            var thumbPath = GetThumbnailPath(userId);
            if (!File.Exists(thumbPath))
                await SaveThumbnailAsync(filePath, thumbPath);

            if (File.Exists(thumbPath))
            {
                var thumbBytes = await File.ReadAllBytesAsync(thumbPath);
                return (thumbBytes, "image/webp");
            }
        }

        var fileBytes = await File.ReadAllBytesAsync(filePath);
        var contentType = GetContentType(Path.GetExtension(filePath));
        return (fileBytes, contentType);
    }

    private async Task SaveThumbnailAsync(string sourcePath, string thumbPath)
    {
        if (IsSvg(sourcePath))
            return;

        await using var input = File.OpenRead(sourcePath);
        using var image = await Image.LoadAsync(input);
        image.Mutate(ctx => ctx.Resize(new ResizeOptions
        {
            Size = new Size(ThumbnailSize, ThumbnailSize),
            Mode = ResizeMode.Crop
        }));

        var encoder = new WebpEncoder { Quality = 80 };
        await image.SaveAsWebpAsync(thumbPath, encoder);
    }

    private string GetThumbnailPath(string userId) =>
        Path.Combine(GetAvatarsFolder(), $"{userId}_thumb.webp");

    private string GetAvatarsFolder() =>
        Path.Combine(WebRootPath, "avatars");

    private string WebRootPath =>
        _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

    private string MapWebPath(string avatarUrl) =>
        Path.Combine(WebRootPath, avatarUrl.TrimStart('/'));

    private static bool IsSvg(string path) =>
        Path.GetExtension(path).Equals(".svg", StringComparison.OrdinalIgnoreCase);

    private static string GetContentType(string extension) => extension.ToLower() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        _ => "application/octet-stream"
    };
}
