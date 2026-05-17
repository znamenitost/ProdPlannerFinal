using ProductionPlanner.Models;

namespace ProductionPlanner.Services.Auth;

public interface IUserProvisioningService
{
    Task<User> GetOrCreateEmployeeAsync(string fullName);
    Task InitializeDefaultUsersAsync();
}
