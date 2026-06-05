using System.Text;
using System.Text.Json;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Infrastructure;

public static class IndexHtmlBootstrapBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static string BuildInjection(string bootstrapJson)
    {
        var builder = new StringBuilder();
        builder.Append("<script type=\"application/json\" id=\"login-employees-bootstrap\">");
        builder.Append(bootstrapJson);
        builder.AppendLine("</script>");

        try
        {
            var employees = JsonSerializer.Deserialize<List<LoginEmployeeDto>>(bootstrapJson, JsonOptions);
            var defaultEmployee = employees?.FirstOrDefault(e => e.FullName == "Дима")
                ?? employees?.FirstOrDefault(e => !string.IsNullOrEmpty(e.Id));

            if (defaultEmployee != null
                && !string.IsNullOrEmpty(defaultEmployee.Id)
                && !string.IsNullOrEmpty(defaultEmployee.AvatarUrl))
            {
                builder.AppendLine(
                    $"<link rel=\"preload\" as=\"image\" href=\"/api/auth/avatar/{defaultEmployee.Id}?w=64\" fetchpriority=\"low\" />");
            }
        }
        catch (JsonException)
        {
            // bootstrap остаётся в script-теге, preload пропускаем
        }

        return builder.ToString().TrimEnd();
    }
}
