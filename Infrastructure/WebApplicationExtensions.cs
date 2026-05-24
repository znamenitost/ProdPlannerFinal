using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Net.Http.Headers;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Services;
using ProductionPlanner.Services.Auth;
using ProductionPlanner.Services.Calendar;
using ProductionPlanner.Services.TaskLists;
using ProductionPlanner.Services.TaskTable;

namespace ProductionPlanner.Infrastructure;

public static class WebApplicationExtensions
{
    public static IServiceCollection AddProductionPlannerServices(this IServiceCollection services)
    {
        services.AddScoped<IWorkHoursCalculator, WorkHoursCalculator>();
        services.AddScoped<IProductionScheduler, ProductionScheduler>();
        services.AddScoped<ITaskLifecycleService, TaskLifecycleService>();
        services.AddScoped<IEmployeeStatsService, EmployeeStatsService>();
        services.AddScoped<IProductionTaskRepository, ProductionTaskRepository>();
        services.AddScoped<ITaskSplitService, TaskSplitService>();
        services.AddScoped<ITaskNotificationService, TaskNotificationService>();
        services.AddScoped<INotificationInboxService, NotificationInboxService>();
        services.AddScoped<ITaskTableService, TaskTableService>();
        services.AddScoped<ITaskListQueryService, TaskListQueryService>();
        services.AddScoped<IWeekCalendarService, WeekCalendarService>();
        services.AddScoped<IUserProvisioningService, UserProvisioningService>();
        services.AddScoped<IAvatarService, AvatarService>();
        services.AddScoped<IAuthSessionService, AuthSessionService>();
        services.AddScoped<IAppTimeService, AppTimeService>();
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
                if (name.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                    || name.Equals("deploy-version.txt", StringComparison.OrdinalIgnoreCase))
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
        app.MapFallbackToFile("index.html");
        return app;
    }
}
