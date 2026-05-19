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

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseStaticFiles();
        app.UseCors("AllowReact");
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseWebSockets();
        app.MapControllers();
        app.MapHub<NotificationHub>("/notificationHub");
        app.MapFallbackToFile("index.html");
        return app;
    }
}
