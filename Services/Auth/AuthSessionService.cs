using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using System.Security.Claims;

namespace ProductionPlanner.Services.Auth;

public class AuthSessionService : IAuthSessionService
{
    private readonly SignInManager<User> _signInManager;
    private readonly UserManager<User> _userManager;
    private readonly IUserProvisioningService _provisioning;

    public AuthSessionService(
        SignInManager<User> signInManager,
        UserManager<User> userManager,
        IUserProvisioningService provisioning)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _provisioning = provisioning;
    }

    public async Task<AuthUserDto> LoginEmployeeAsync(string fullName)
    {
        var user = await _provisioning.GetOrCreateEmployeeAsync(fullName);
        await _signInManager.SignInAsync(user, isPersistent: false);
        return await MapUserAsync(user);
    }

    public async Task<(AuthUserDto? User, string? ErrorMessage)> LoginAdminAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
            return (null, null);

        if (user.Role != "Admin")
            return (null, "Доступ только для администраторов");

        var userName = user.UserName ?? user.Email;
        if (string.IsNullOrEmpty(userName))
            return (null, "Ошибка: имя пользователя не найдено");

        var result = await _signInManager.PasswordSignInAsync(userName, password, false, false);
        if (!result.Succeeded)
            return (null, null);

        return (await MapUserAsync(user), null);
    }

    public async Task<AuthUserDto> GetCurrentUserAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return new AuthUserDto { IsAuthenticated = false };

        var user = await _userManager.GetUserAsync(principal);
        if (user == null)
        {
            await _signInManager.SignOutAsync();
            return new AuthUserDto { IsAuthenticated = false };
        }

        if (user.Role == "Employee" && !AuthEmployees.IsAllowed(user.FullName))
        {
            await _signInManager.SignOutAsync();
            return new AuthUserDto { IsAuthenticated = false };
        }

        return await MapUserAsync(user);
    }

    public async Task<IReadOnlyList<LoginEmployeeDto>> GetLoginEmployeesAsync()
    {
        return await _userManager.Users
            .AsNoTracking()
            .Where(u => u.Role == "Employee" && u.IsActive && AuthEmployees.AllowedFullNames.Contains(u.FullName))
            .OrderBy(u => u.FullName)
            .Select(u => new LoginEmployeeDto
            {
                Id = u.Id,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl
            })
            .ToListAsync();
    }

    private async Task<AuthUserDto> MapUserAsync(User user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        return new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = roles.FirstOrDefault() ?? user.Role,
            IsAuthenticated = true,
            AvatarUrl = user.AvatarUrl
        };
    }
}
