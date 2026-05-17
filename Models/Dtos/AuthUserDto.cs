namespace ProductionPlanner.Models.Dtos;

public class AuthUserDto
{
    public string? Id { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? Role { get; set; }
    public bool IsAuthenticated { get; set; }
    public string? AvatarUrl { get; set; }
}
