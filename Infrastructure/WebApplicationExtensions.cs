using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Net.Http.Headers;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Services;
using ProductionPlanner.Services.Auth;
using ProductionPlanner.Services.Calendar;
using ProductionPlanner.Services.TaskLists;
using ProductionPlanner.Services.AppSettings;
using ProductionPlanner.Services.TaskCdrPreview;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Infrastructure;

public static class WebApplicationExtensions
{
    public static IServiceCollection AddProductionPlannerServices(this IServiceCollection services)
    {
        services.AddScoped<IWorkHoursCalculator, WorkHoursCalculator>();
        services.AddScoped<IProductionScheduler, ProductionScheduler>();
        services.AddScoped<IPlanningWarningService, PlanningWarningService>();
        services.AddScoped<ITaskLifecycleService, TaskLifecycleService>();
        services.AddScoped<IEmployeeStatsService, EmployeeStatsService>();
        services.AddScoped<IProductionTaskRepository, ProductionTaskRepository>();
        services.AddScoped<ITaskSplitService, TaskSplitService>();
        services.AddSingleton<ITaskDataSyncHubBroadcaster, TaskDataSyncHubBroadcaster>();
        services.AddScoped<ITaskNotificationService, TaskNotificationService>();
        services.AddScoped<INotificationInboxService, NotificationInboxService>();
        services.AddScoped<ITaskTableService, TaskTableService>();
        services.AddScoped<ITaskCdrPreviewService, TaskCdrPreviewService>();
        services.AddScoped<ICdrPreviewRetryService, CdrPreviewRetryService>();
        services.AddScoped<IAppSettingsService, AppSettingsService>();
        services.AddScoped<IAutoAssignSettingsService, AutoAssignSettingsService>();
        services.AddScoped<ITaskTableSortSettingsService, TaskTableSortSettingsService>();
        services.AddScoped<ITaskListQueryService, TaskListQueryService>();
        services.AddScoped<IEmployeeAssignmentLoadService, EmployeeAssignmentLoadService>();
        services.AddScoped<IWeekCalendarService, WeekCalendarService>();
        services.AddScoped<IUserProvisioningService, UserProvisioningService>();
        services.AddMemoryCache();
        services.AddScoped<IAvatarService, AvatarService>();
        services.AddScoped<IAuthSessionService, AuthSessionService>();
        services.AddSingleton<ILoginEmployeesBootstrapService, LoginEmployeesBootstrapService>();
        services.AddHostedService<LoginEmployeesBootstrapHostedService>();
        services.AddScoped<IAppTimeService, AppTimeService>();
        services.AddHostedService<EndOfWorkDayBackgroundService>();
        services.AddHostedService<CdrPreviewRetryBackgroundService>();
        return services;
    }

    public static WebApplication ConfigureProductionPlannerPipeline(this WebApplication app)
    {
        if (string.IsNullOrEmpty(app.Environment.WebRootPath))
            app.Environment.WebRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

        var avatarsDir = Path.Combine(app.Environment.WebRootPath, "avatars");
        if (!Directory.Exists(avatarsDir))
            Directory.CreateDirectory(avatarsDir);

        app.UseForwardedHeaders(new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        });

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                var name = Path.GetFileName(ctx.File.Name);
                var path = ctx.Context.Request.Path.Value ?? "";
                if (name.Equals("login-employees.json", StringComparison.OrdinalIgnoreCase))
                {
                    var headers = ctx.Context.Response.Headers;
                    headers[HeaderNames.CacheControl] = "public, max-age=3600";
                }
                else if (name.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                    || name.Equals("deploy-version.txt", StringComparison.OrdinalIgnoreCase)
                    || path.Contains("/assets/", StringComparison.OrdinalIgnoreCase))
                {
                    var headers = ctx.Context.Response.Headers;
                    headers[HeaderNames.CacheControl] = "no-cache, no-store, must-revalidate";
                    headers[HeaderNames.Pragma] = "no-cache";
                    headers[HeaderNames.Expires] = "0";
                }
            }
        });
        app.UseCors("AllowReact");
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseWebSockets();
        app.MapControllers();
        app.MapHub<NotificationHub>("/notificationHub");
        app.MapFallback(async (HttpContext context) =>
        {
            var path = context.Request.Path.Value ?? "";
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/notificationHub", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var indexPath = Path.Combine(app.Environment.WebRootPath!, "index.html");
            if (!File.Exists(indexPath))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var html = await File.ReadAllTextAsync(indexPath);
            var bootstrapService = context.RequestServices.GetRequiredService<ILoginEmployeesBootstrapService>();
            var injection = IndexHtmlBootstrapBuilder.BuildInjection(bootstrapService.GetBootstrapJson());
            html = html.Replace("<!-- LOGIN_EMPLOYEES_BOOTSTRAP -->", injection, StringComparison.Ordinal);

            context.Response.ContentType = "text/html; charset=utf-8";
            context.Response.Headers[HeaderNames.CacheControl] = "no-cache, no-store, must-revalidate";
            context.Response.Headers[HeaderNames.Pragma] = "no-cache";
            context.Response.Headers[HeaderNames.Expires] = "0";
            await context.Response.WriteAsync(html);
        });
        return app;
    }
}
