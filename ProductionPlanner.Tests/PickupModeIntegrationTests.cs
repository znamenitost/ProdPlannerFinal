using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Tests;

/// <summary>
/// Сквозная проверка режима выдачи на реальной SQLite (in-memory):
/// назначение номеров по буквенному указателю и prefix-поиск/сортировка в репозитории.
/// </summary>
public class PickupModeIntegrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<ApplicationDbContext> _options;

    public PickupModeIntegrationTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        _options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var db = CreateDb();
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private ApplicationDbContext CreateDb() => new(_options);

    private sealed class NullTaskNotificationService : ITaskNotificationService
    {
        public Task NotifyNewTaskAsync(ProductionTask task) => Task.CompletedTask;
        public Task NotifyTaskUpdatedAsync(ProductionTask task, string? oldEmployeeName = null) => Task.CompletedTask;
        public Task NotifyTaskDeletedAsync(int taskId, IEnumerable<string> employeeNames) => Task.CompletedTask;
        public Task NotifyStatusChangedAsync(ProductionTask task, string newStatus) => Task.CompletedTask;
        public Task NotifyProgressChangedAsync(ProductionTask task, double progress) => Task.CompletedTask;
        public Task NotifyTaskReadyToStartAsync(ProductionTask task, JobStatus readyStatus) => Task.CompletedTask;
        public Task NotifySequentialStageReadyAsync(ProductionTask task, int stageNumber) => Task.CompletedTask;
        public Task NotifyTaskCommentAddedAsync(ProductionTask task, string authorUserId, string? recipientUserId) => Task.CompletedTask;
    }

    private sealed class StubTimeService : IAppTimeService
    {
        public DateTime Now { get; } = new(2026, 8, 2, 12, 0, 0, DateTimeKind.Utc);
        public void SetMock(DateTime? mock) { }
        public void ResetMock() { }
    }

    private static ProductionTask MakeTask(string folderPath, string fileName = "file.cdr") => new()
    {
        FolderPath = folderPath,
        FileName = fileName,
        Comment = "",
        Type = "Резка",
        EmployeeName = "Дима",
        Status = JobStatus.Completed,
        EstimateHours = 1,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task EnsurePickupCodes_AssignsLetterByAlphabetIndex()
    {
        int igorId, ivanId, aretaId;
        await using (var db = CreateDb())
        {
            var igor = MakeTask("Клиенты/И/Игорь/Визитки");
            var ivan = MakeTask("Клиенты/И/Иван");
            var areta = MakeTask("Клиенты/А/Арета");
            var hidden = MakeTask("Клиенты/И/Игорь/Скрытый");
            hidden.HiddenFromTaskTable = true;
            var child = MakeTask("Клиенты/И/Игорь/Этап");
            child.ParentRowNumber = 999;
            db.ProductionTasks.AddRange(igor, ivan, areta, hidden, child);
            await db.SaveChangesAsync();
            igorId = igor.Id;
            ivanId = ivan.Id;
            aretaId = areta.Id;
        }

        await using (var db = CreateDb())
        {
            var service = new CustomerOrderTrackingService(db, new NullTaskNotificationService());
            var codes = await service.EnsurePickupCodesForTasksAsync([igorId, ivanId, aretaId]);

            Assert.Equal(3, codes.Count);
            Assert.StartsWith("И", codes[igorId]);
            Assert.StartsWith("И", codes[ivanId]);
            Assert.StartsWith("А", codes[aretaId]);
            Assert.Equal(codes.Count, codes.Values.Distinct().Count());
        }

        // Коды сохранены и не переназначаются повторно.
        await using (var db = CreateDb())
        {
            var igor = await db.ProductionTasks.FindAsync(igorId);
            Assert.NotNull(igor!.PickupCode);

            var service = new CustomerOrderTrackingService(db, new NullTaskNotificationService());
            var again = await service.EnsurePickupCodesForTasksAsync([igorId]);
            Assert.Equal(igor.PickupCode, again[igorId]);
        }
    }

    // Код, выданный по старой семантике (буква последней папки), перевыдаётся
    // с буквы алфавитного указателя; корректные коды не трогаем.
    [Fact]
    public async Task EnsurePickupCodes_ReissuesCodeWhenLetterMismatchesPath()
    {
        int staleId;
        await using (var db = CreateDb())
        {
            var stale = MakeTask("C:\\Users\\пк\\Yandex.Disk\\Клиенты\\А\\Арт фешн групп\\600 шт");
            stale.PickupCode = "Ш07";
            var fresh = MakeTask("Клиенты/Б/Борис");
            fresh.PickupCode = "Б42";
            db.ProductionTasks.AddRange(stale, fresh);
            await db.SaveChangesAsync();
            staleId = stale.Id;
        }

        await using (var db = CreateDb())
        {
            var service = new CustomerOrderTrackingService(db, new NullTaskNotificationService());
            var codes = await service.EnsurePickupCodesForTasksAsync([staleId]);

            Assert.StartsWith("А", codes[staleId]);
            Assert.NotEqual("Ш07", codes[staleId]);

            var fresh = await db.ProductionTasks.SingleAsync(t => t.FolderPath == "Клиенты/Б/Борис");
            Assert.Equal("Б42", fresh.PickupCode);
        }

        // Повторный прогон ничего не меняет — новый код соответствует пути.
        await using (var db = CreateDb())
        {
            var service = new CustomerOrderTrackingService(db, new NullTaskNotificationService());
            var again = await service.EnsurePickupCodesForTasksAsync([staleId]);
            var persisted = await db.ProductionTasks.FindAsync(staleId);
            Assert.Equal(persisted!.PickupCode, again[staleId]);
        }
    }

    [Fact]
    public async Task PickupPrefixSearch_FiltersAndSorts()
    {
        await using (var db = CreateDb())
        {
            var i11 = MakeTask("Клиенты/И/Иван", "a.cdr");
            i11.PickupCode = "И11";
            var i12 = MakeTask("Клиенты/И/Игорь/Визитки", "b.cdr");
            i12.PickupCode = "И12";
            var a05 = MakeTask("Клиенты/А/Арета", "c.cdr");
            a05.PickupCode = "А05";
            var noCode = MakeTask("Клиенты/Б/Борис", "d.cdr");
            db.ProductionTasks.AddRange(i11, i12, a05, noCode);
            await db.SaveChangesAsync();
        }

        await using (var db = CreateDb())
        {
            var repo = new ProductionTaskRepository(db, new StubTimeService());

            var byPrefix = await repo.GetRootTasksPaginatedAsync(
                1, 50, pickupCodePrefix: "И1", pickupSort: true);
            Assert.Equal(2, byPrefix.TotalCount);
            Assert.All(byPrefix.Items, t => Assert.StartsWith("И1", t.PickupCode));

            var all = await repo.GetRootTasksPaginatedAsync(1, 50, pickupSort: true);
            Assert.Equal(4, all.TotalCount);
            // Сортировка по пути: «Клиенты/А/…» раньше «Клиенты/Б/…» раньше «Клиенты/И/…».
            Assert.Equal(
                ["Клиенты/А/Арета", "Клиенты/Б/Борис", "Клиенты/И/Иван", "Клиенты/И/Игорь/Визитки"],
                all.Items.Select(t => t.FolderPath).ToList());
        }
    }
}
