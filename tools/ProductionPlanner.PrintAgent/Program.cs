using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;

namespace ProductionPlanner.PrintAgent;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => ShowFatal("Ошибка интерфейса", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception ex)
                ShowFatal("Критическая ошибка", ex);
            else
                MessageBox.Show(
                    Convert.ToString(e.ExceptionObject) ?? "Неизвестная ошибка",
                    "Print Agent",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
        };

        Mutex? mutex = null;
        try
        {
            mutex = new Mutex(true, "ProductionPlanner.PrintAgent", out var createdNew);
            if (!createdNew)
            {
                MessageBox.Show(
                    "Агент печати уже запущен.\n\nПроверьте значок у часов (трей).\n"
                    + "Если окна нет — завершите ProductionPlanner.PrintAgent в диспетчере задач.",
                    "Print Agent",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            var config = AgentConfig.Load();
            Application.Run(new MainForm(config));
        }
        catch (Exception ex)
        {
            ShowFatal("Не удалось запустить агент печати", ex);
        }
        finally
        {
            mutex?.Dispose();
        }
    }

    private static void ShowFatal(string title, Exception ex)
    {
        try
        {
            var text = title + "\n\n" + ex.GetType().Name + ": " + ex.Message
                + "\n\nРаспакуйте ZIP целиком в папку (рядом с exe должны быть все .dll),"
                + "\nнужен .NET Framework 4.8."
                + "\n\n" + ex;
            MessageBox.Show(text, "Print Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        catch
        {
            // last resort
        }
    }
}

internal sealed class AgentConfig
{
    public string ServerUrl { get; set; } = "https://app-mainstream.ru";
    public string AccessToken { get; set; } = "2e026921e1a688781cffd73650cd39d8d73ff67893dcdb59";
    public string PrinterName { get; set; } = "";
    public bool RunAtStartup { get; set; } = true;
    public string AgentName { get; set; } = Environment.MachineName;

    private static string ConfigPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "ProductionPlanner",
            "PrintAgent",
            "config.json");

    public static AgentConfig Load()
    {
        try
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                return JsonSerializer.Deserialize<AgentConfig>(json) ?? new AgentConfig();
            }
        }
        catch
        {
            // ignore corrupt config
        }

        return new AgentConfig();
    }

    public void Save()
    {
        var dir = Path.GetDirectoryName(ConfigPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(ConfigPath, json);
    }
}
