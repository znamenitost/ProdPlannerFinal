using System.Text;

namespace ProductionPlanner.Infrastructure;

public static class AppOfflineCli
{
    public static int Run(string[] args)
    {
        var output = Path.Combine(Directory.GetCurrentDirectory(), "app_offline.htm");
        var wwwroot = ResolveWwwRoot(args);

        for (var i = 1; i < args.Length; i++)
        {
            if (args[i].Equals("--output", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                output = Path.GetFullPath(args[++i]);
                continue;
            }

            if (args[i].Equals("--wwwroot", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                wwwroot = Path.GetFullPath(args[++i]);
            }
        }

        var spritesDir = AppOfflineSpritePaths.Resolve(wwwroot, Directory.GetCurrentDirectory());
        if (!Directory.Exists(spritesDir))
        {
            Console.Error.WriteLine($"Не найдена папка спрайтов (искали от {wwwroot})");
            return 1;
        }

        var html = AppOfflineMaintenancePage.Render(spritesDir);
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        File.WriteAllText(output, html, Encoding.UTF8);
        Console.WriteLine($"Создан {output}");
        return 0;
    }

    private static string ResolveWwwRoot(string[] args)
    {
        for (var i = 1; i < args.Length; i++)
        {
            if (args[i].Equals("--wwwroot", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                return Path.GetFullPath(args[i + 1]);
        }

        var cwd = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(cwd, "wwwroot"),
            Path.Combine(cwd, "publish", "wwwroot"),
        };

        foreach (var candidate in candidates)
        {
            if (Directory.Exists(Path.Combine(candidate, "sprites")))
                return candidate;
        }

        return Path.Combine(cwd, "wwwroot");
    }
}
