using System.Globalization;
using System.Security.Cryptography;

namespace ProductionPlanner.Services.CustomerOrders;

/// <summary>
/// Номер выдачи: буква алфавитного указателя + две цифры («И42»).
/// Единая точка нормализации и генерации — используется и выдачей, и печатью этикеток.
/// </summary>
public static class PickupCodes
{
    /// <summary>Верхний регистр без пробелов — «и11» → «И11».</summary>
    public static string Normalize(string? code)
    {
        var raw = (code ?? "").Trim();
        return raw.Length == 0 ? "" : raw.ToUpper(CultureInfo.InvariantCulture);
    }

    /// <summary>Случайный свободный код на букву среди активных задач; used пополняется выданным кодом.</summary>
    public static string Allocate(char letter, HashSet<string> used)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            var digits = RandomNumberGenerator.GetInt32(0, 100);
            var code = $"{letter}{digits:D2}";
            if (used.Add(code))
                return code;
        }

        // Fallback, если 00–99 для буквы исчерпаны среди активных задач.
        for (var digits = 0; digits < 100; digits++)
        {
            var code = $"{letter}{digits:D2}";
            if (used.Add(code))
                return code;
        }

        return $"{letter}{RandomNumberGenerator.GetInt32(100, 1000)}";
    }
}
