namespace ProductionPlanner.Models;

public class EmployeeLoginRequest
{
    public string FullName { get; set; } = string.Empty;
}

public class AdminLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
