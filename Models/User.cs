// ./Models/User.cs
using Microsoft.AspNetCore.Identity;

namespace ProductionPlanner.Models
{
    public class User : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = "Employee";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public string? AvatarUrl { get; set; } // Путь к аватару
    }
}