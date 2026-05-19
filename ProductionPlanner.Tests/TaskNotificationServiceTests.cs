using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Tests;

public class TaskNotificationServiceTests
{
    [Fact]
    public void GetNotificationTitle_uses_file_when_display_name_empty()
    {
        var task = new ProductionTask { Id = 5, FileName = "report.pdf", FolderPath = "" };
        Assert.Equal("report.pdf", TaskNotificationService.GetNotificationTitle(task));
    }

    [Fact]
    public void GetNotificationTitle_falls_back_to_task_id()
    {
        var task = new ProductionTask { Id = 12 };
        Assert.Equal("Задача #12", TaskNotificationService.GetNotificationTitle(task));
    }
}
