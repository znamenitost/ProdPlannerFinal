using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;

namespace ProductionPlanner.Services.Auth;

public class UserProvisioningService : IUserProvisioningService
{
    private readonly UserManager<User> _userManager;

    public UserProvisioningService(UserManager<User> userManager)
    {
        _userManager = userManager;
    }

    public async Task<User> GetOrCreateEmployeeAsync(string fullName)
    {
        var user = _userManager.Users.FirstOrDefault(u => u.FullName == fullName && u.Role == "Employee");
        if (user != null)
            return user;

        var email = $"{fullName.ToLower()}@employee.local";
        user = new User
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, "Employee123!");
        if (!createResult.Succeeded)
            throw new InvalidOperationException("Ошибка создания пользователя");

        await _userManager.AddToRoleAsync(user, "Employee");
        return user;
    }

    public async Task InitializeDefaultUsersAsync()
    {
        await EnsureAdminAsync("pavel@admin.com", "Павел", "Admin123!");
        await EnsureEmployeeAsync("dima@employee.local", "Дима");
        await EnsureEmployeeAsync("yaromer@employee.local", "Яромир");
    }

    private async Task EnsureAdminAsync(string email, string fullName, string password)
    {
        if (await _userManager.FindByEmailAsync(email) != null)
            return;

        var user = new User
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            Role = "Admin",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await _userManager.CreateAsync(user, password);
        await _userManager.AddToRoleAsync(user, "Admin");
    }

    private async Task EnsureEmployeeAsync(string email, string fullName)
    {
        if (_userManager.Users.Any(u => u.FullName == fullName))
            return;

        var user = new User
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            Role = "Employee",
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
        await _userManager.CreateAsync(user, "Employee123!");
        await _userManager.AddToRoleAsync(user, "Employee");
    }
}
