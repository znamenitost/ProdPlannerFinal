using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Services.Auth;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<User> _signInManager;
    private readonly IAuthSessionService _authSession;
    private readonly IUserProvisioningService _provisioning;

    public AuthController(
        SignInManager<User> signInManager,
        IAuthSessionService authSession,
        IUserProvisioningService provisioning)
    {
        _signInManager = signInManager;
        _authSession = authSession;
        _provisioning = provisioning;
    }

    [HttpGet("login-employees")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetLoginEmployees()
    {
        var employees = await _authSession.GetLoginEmployeesAsync();
        Response.Headers.CacheControl = "public, max-age=300";
        return Ok(employees);
    }

    [HttpPost("login-employee")]
    public async Task<IActionResult> LoginEmployee([FromBody] EmployeeLoginRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.FullName))
            return BadRequest(new { message = "Имя сотрудника обязательно" });

        try
        {
            var user = await _authSession.LoginEmployeeAsync(request.FullName);
            return Ok(ToResponse(user));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("login-admin")]
    public async Task<IActionResult> LoginAdmin([FromBody] AdminLoginRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Email и пароль обязательны" });

        var (user, errorMessage) = await _authSession.LoginAdminAsync(request.Email, request.Password);
        if (user == null)
        {
            return Unauthorized(new
            {
                message = errorMessage ?? "Неверный email или пароль"
            });
        }

        return Ok(ToResponse(user));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { message = "Выход выполнен" });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _authSession.GetCurrentUserAsync(User);
        if (!user.IsAuthenticated)
            return Ok(new { isAuthenticated = false });

        return Ok(ToResponse(user));
    }

    [HttpPost("init-users")]
    public async Task<IActionResult> InitUsers()
    {
        await _provisioning.InitializeDefaultUsersAsync();
        return Ok(new { message = "Пользователи инициализированы" });
    }

    private static object ToResponse(Models.Dtos.AuthUserDto user) => new
    {
        id = user.Id,
        email = user.Email,
        fullName = user.FullName,
        role = user.Role,
        isAuthenticated = user.IsAuthenticated,
        avatarUrl = user.AvatarUrl
    };
}
