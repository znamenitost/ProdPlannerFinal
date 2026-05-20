using Npgsql;

namespace ProductionPlanner.Infrastructure;

public static class PostgresConnectionHelper
{
    public static string Normalize(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return connectionString;

        var builder = new NpgsqlConnectionStringBuilder(connectionString.Trim());

        if (builder.Host?.Contains("1gb.ru", StringComparison.OrdinalIgnoreCase) == true)
        {
            // На shared-хостинге 1gb внутренний PostgreSQL обычно без SSL
            if (builder.SslMode is SslMode.Prefer or SslMode.Require or SslMode.VerifyCA or SslMode.VerifyFull)
                builder.SslMode = SslMode.Disable;
        }

        if (builder.Timeout <= 0)
            builder.Timeout = 30;
        if (builder.CommandTimeout <= 0)
            builder.CommandTimeout = 60;

        return builder.ConnectionString;
    }

    public static string Mask(string connectionString)
    {
        try
        {
            var b = new NpgsqlConnectionStringBuilder(connectionString);
            if (!string.IsNullOrEmpty(b.Password))
                b.Password = "***";
            return b.ToString();
        }
        catch
        {
            return "(некорректная строка подключения)";
        }
    }
}
