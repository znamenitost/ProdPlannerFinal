using System;
using Microsoft.Win32;

namespace ProductionPlanner.PrintAgent;

internal static class AutostartHelper
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "ProductionPlannerPrintAgent";

    public static bool TryEnable(string exePath)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true)
                ?? Registry.CurrentUser.CreateSubKey(RunKeyPath);
            if (key == null)
                return false;

            key.SetValue(ValueName, "\"" + exePath + "\"");
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool TryDisable()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            key?.DeleteValue(ValueName, throwOnMissingValue: false);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
