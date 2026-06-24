using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;
using System.Security.Claims;

namespace ProductionPlanner.Services.Auth;

public interface IAuthSessionService
{
    Task<AuthUserDto> LoginEmployeeAsync(string fullName);
    Task<(AuthUserDto? User, string? ErrorMessage)> LoginAdminAsync(string email, string password);
    Task<AuthUserDto> GetCurrentUserAsync(ClaimsPrincipal principal);
    Task<IReadOnlyList<LoginEmployeeDto>> GetLoginEmployeesAsync();
    Task<IReadOnlyList<LoginAdminDto>> GetLoginAdminsAsync();
    void InvalidateLoginEmployeesCache();
}
