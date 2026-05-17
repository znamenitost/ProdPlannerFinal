using Microsoft.AspNetCore.Identity;
using ProductionPlanner.Models;
using ProductionPlanner.Services.Auth;

namespace ProductionPlanner.Infrastructure;

public static class IdentitySeedService
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = serviceProvider.GetRequiredService<UserManager<User>>();
        var logger = serviceProvider.GetRequiredService<ILogger<Program>>();

        string[] roles = ["Admin", "Employee", "Viewer"];
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        var provisioning = serviceProvider.GetRequiredService<IUserProvisioningService>();
        await provisioning.InitializeDefaultUsersAsync();

        logger.LogInformation("Пользователи и роли проверены при старте приложения");
    }
}
