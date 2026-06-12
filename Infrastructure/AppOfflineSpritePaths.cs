using Microsoft.AspNetCore.Hosting;

namespace ProductionPlanner.Infrastructure;

public static class AppOfflineSpritePaths
{
    public static string Resolve(IWebHostEnvironment env) =>
        Resolve(env.WebRootPath, env.ContentRootPath);

    public static string Resolve(string wwwrootPath, string contentRootPath)
    {
        var candidates = new[]
        {
            Path.Combine(wwwrootPath, "sprites"),
            Path.Combine(contentRootPath, "sprites"),
            Path.Combine(contentRootPath, "publish", "wwwroot", "sprites"),
        };

        foreach (var candidate in candidates)
        {
            if (Directory.Exists(candidate))
                return candidate;
        }

        return Path.Combine(wwwrootPath, "sprites");
    }
}
