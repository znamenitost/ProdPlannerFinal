using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services.Auth;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/auth")]
public class UserAvatarController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly IAvatarService _avatarService;

    public UserAvatarController(UserManager<User> userManager, IAvatarService avatarService)
    {
        _userManager = userManager;
        _avatarService = avatarService;
    }

    [Authorize]
    [HttpPost("upload-avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
            return Unauthorized(new { message = "Пользователь не найден" });

        try
        {
            var avatarUrl = await _avatarService.UploadAsync(user, file);
            return Ok(new { avatarUrl, message = "Аватар загружен" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("avatar/{userId}")]
    public async Task<IActionResult> GetAvatar(string userId)
    {
        var file = await _avatarService.GetFileAsync(userId);
        if (file == null)
            return NoContent();

        return File(file.Value.Bytes, file.Value.ContentType);
    }

    [Authorize]
    [HttpDelete("avatar")]
    public async Task<IActionResult> DeleteAvatar()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
            return Unauthorized(new { message = "Пользователь не найден" });

        await _avatarService.DeleteAsync(user);
        return Ok(new { message = "Аватар удалён" });
    }
}
