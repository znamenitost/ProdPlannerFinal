using ProductionPlanner.Models;

namespace ProductionPlanner.Services.Auth;

public interface IAvatarService
{
    Task<string> UploadAsync(User user, IFormFile file);
    Task DeleteAsync(User user);
    Task<(byte[] Bytes, string ContentType)?> GetFileAsync(string userId, int? maxWidth = null);
}
