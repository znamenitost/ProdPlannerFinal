using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ProductionPlanner.Controllers;

[ApiController]
[Route("api/deploy-info")]
[AllowAnonymous]
public class DeployInfoController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var root = Directory.GetCurrentDirectory();
        var paths = new[]
        {
            Path.Combine(root, "deploy-version.txt"),
            Path.Combine(root, "wwwroot", "deploy-version.txt")
        };

        foreach (var path in paths)
        {
            if (!System.IO.File.Exists(path))
                continue;

            var lines = System.IO.File.ReadAllLines(path)
                .Select(l => l.Trim())
                .Where(l => l.Length > 0)
                .ToList();

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var line in lines)
            {
                var idx = line.IndexOf('=');
                if (idx <= 0)
                    continue;
                map[line[..idx].Trim()] = line[(idx + 1)..].Trim();
            }

            map.TryGetValue("sha", out var sha);
            map.TryGetValue("branch", out var branch);
            map.TryGetValue("features", out var features);
            map.TryGetValue("bundle", out var bundle);

            return Ok(new
            {
                sha,
                branch,
                features,
                bundle,
                source = Path.GetFileName(path)
            });
        }

        return Ok(new { sha = (string?)null, message = "deploy-version.txt not found on server" });
    }
}
