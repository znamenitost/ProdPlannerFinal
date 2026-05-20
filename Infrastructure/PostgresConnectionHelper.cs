using Npgsql;

namespace ProductionPlanner.Infrastructure;

public static class PostgresConnectionHelper
{
    public static string Normalize(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return connectionString;

        var raw = connectionString.Trim().Trim('"', '\'');

        NpgsqlConnectionStringBuilder builder;
        if (raw.Contains(';', StringComparison.Ordinal))
        {
            builder = new NpgsqlConnectionStringBuilder(raw);
            if (builder.Host?.Contains(' ') == true)
                builder = ParseKeyValuePairs(builder.Host);
        }
        else if (raw.Contains(' ') && raw.Contains('='))
        {
            builder = ParseKeyValuePairs(raw);
        }
        else
        {
            builder = new NpgsqlConnectionStringBuilder { Host = raw };
        }

        if (string.IsNullOrWhiteSpace(builder.Host))
            throw new InvalidOperationException(
                "Некорректная строка подключения PostgreSQL. Используйте формат: " +
                "Host=postgres82.1gb.ru;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Disable");

        if (builder.Host.Contains(' ') || builder.Host.Contains('='))
            throw new InvalidOperationException(
                $"Некорректный Host='{builder.Host}'. В секрете GitHub не должно быть пробелов вместо ';'.");

        if (builder.Host.Contains("1gb.ru", StringComparison.OrdinalIgnoreCase))
        {
            if (builder.SslMode is SslMode.Prefer or SslMode.Require or SslMode.VerifyCA or SslMode.VerifyFull)
                builder.SslMode = SslMode.Disable;
        }

        if (builder.Port == 0)
            builder.Port = 5432;
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
            var normalized = Normalize(connectionString);
            var b = new NpgsqlConnectionStringBuilder(normalized);
            if (!string.IsNullOrEmpty(b.Password))
                b.Password = "***";
            return b.ToString();
        }
        catch
        {
            return "(некорректная строка подключения)";
        }
    }

    private static NpgsqlConnectionStringBuilder ParseKeyValuePairs(string text)
    {
        var builder = new NpgsqlConnectionStringBuilder();
        foreach (var token in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = token.IndexOf('=');
            if (eq <= 0)
                continue;

            var key = token[..eq].Trim().ToLowerInvariant();
            var value = token[(eq + 1)..].Trim().Trim('"', '\'');

            switch (key)
            {
                case "host":
                    builder.Host = value;
                    break;
                case "port":
                    builder.Port = int.Parse(value);
                    break;
                case "dbname":
                case "database":
                    builder.Database = value;
                    break;
                case "user":
                case "username":
                case "user id":
                case "userid":
                    builder.Username = value;
                    break;
                case "password":
                case "pwd":
                    builder.Password = value;
                    break;
                case "sslmode":
                case "ssl mode":
                    if (Enum.TryParse<SslMode>(value, true, out var ssl))
                        builder.SslMode = ssl;
                    break;
            }
        }

        return builder;
    }
}
