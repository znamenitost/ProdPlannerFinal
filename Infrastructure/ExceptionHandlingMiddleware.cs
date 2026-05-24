using System.Net;
using System.Text.Json;

namespace ProductionPlanner.Infrastructure;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
                throw;

            _logger.LogError(ex, "Необработанное исключение {Method} {Path}",
                context.Request.Method, context.Request.Path);

            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            var payload = new Dictionary<string, string?>
            {
                ["error"] = _environment.IsDevelopment()
                    ? ex.Message
                    : "Внутренняя ошибка сервера"
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
        }
    }
}
