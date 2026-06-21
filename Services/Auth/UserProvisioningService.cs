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
        if (!AuthEmployees.IsAllowed(fullName))
            throw new InvalidOperationException("Неизвестный сотрудник");

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
        foreach (var (email, fullName) in AuthAdmins.Accounts)
            await EnsureAdminAsync(email, fullName, AuthAdmins.DefaultPassword);

        await EnsureEmployeeAsync("dima@employee.local", "Дима");
        await EnsureEmployeeAsync("yaromer@employee.local", "Яромир");
        await RemoveUnauthorizedEmployeesAsync();
    }

    private async Task RemoveUnauthorizedEmployeesAsync()
    {
        var extras = _userManager.Users
            .Where(u => u.Role == "Employee" && !AuthEmployees.AllowedFullNames.Contains(u.FullName))
            .ToList();

        foreach (var user in extras)
            await _userManager.DeleteAsync(user);
    }

    private async Task EnsureAdminAsync(string email, string fullName, string password)
    {
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser != null)
        {
            if (!await _userManager.CheckPasswordAsync(existingUser, password))
            {
                var resetToken = await _userManager.GeneratePasswordResetTokenAsync(existingUser);
                await _userManager.ResetPasswordAsync(existingUser, resetToken, password);
            }

            return;
        }

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
