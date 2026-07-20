using System;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;

namespace ProductionPlanner.PrintAgent;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        using var mutex = new System.Threading.Mutex(true, "ProductionPlanner.PrintAgent", out var createdNew);
        if (!createdNew)
        {
            MessageBox.Show(
                "Агент печати уже запущен.",
                "Print Agent",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        var config = AgentConfig.Load();
        Application.Run(new MainForm(config));
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
