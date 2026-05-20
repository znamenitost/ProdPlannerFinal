using System.Runtime.InteropServices;
using System.Text;

namespace ProductionPlanner.Infrastructure;

public static class StartupDiagnostics
{
    public static string LogsDirectory =>
        Path.Combine(Directory.GetCurrentDirectory(), "logs");

    public static void Write(string message, Exception? exception = null)
    {
        try
        {
            Directory.CreateDirectory(LogsDirectory);
            var path = Path.Combine(LogsDirectory, "startup-errors.log");
            var line = new StringBuilder()
                .Append('[').Append(DateTime.UtcNow.ToString("O")).Append("] ")
                .Append(message);

            if (exception != null)
                line.AppendLine().Append(exception);

            File.AppendAllText(path, line + Environment.NewLine, Encoding.UTF8);
        }
        catch
        {
            // ignore secondary logging failures
        }
    }

    public static void LogEnvironment()
    {
        Write(
            $"OS={RuntimeInformation.OSDescription}; " +
            $"Arch={RuntimeInformation.OSArchitecture}; " +
            $"ProcessArch={RuntimeInformation.ProcessArchitecture}; " +
            $"Framework={RuntimeInformation.FrameworkDescription}; " +
            $"Cwd={Directory.GetCurrentDirectory()}; " +
            $"ASPNETCORE_ENVIRONMENT={Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")}; " +
            $"ASPNETCORE_PORT={Environment.GetEnvironmentVariable("ASPNETCORE_PORT")}");
    }
}
