using ProductionPlanner.Models;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Tests;

public class CustomerOrderKeyTests
{
    [Theory]
    [InlineData("А/Арета", "Арета", "арета")]
    [InlineData("Клиенты/А/Арета", "Арета", "арета")]
    [InlineData("Д/Дистри", "Дистри", "дистри")]
    [InlineData("Фрэшмемори", "Фрэшмемори", "фрэшмемори")]
    public void TryGetDisplayName_And_Key(string path, string display, string key)
    {
        Assert.Equal(display, CustomerOrderKey.TryGetDisplayName(path));
        Assert.Equal(key, CustomerOrderKey.TryGetNormalizedKey(path));
        Assert.True(CustomerOrderKey.Matches(path, key));
    }

    [Fact]
    public void ResolvePickupLetter_UsesAlphabetFolder()
    {
        Assert.Equal('А', CustomerOrderKey.ResolvePickupLetter("А/Арета", "Арета"));
        Assert.Equal('Д', CustomerOrderKey.ResolvePickupLetter("Клиенты/Д/Дистри", "Дистри"));
    }

    [Fact]
    public void BuildOrderTitle_CombinesFileAndComment()
    {
        Assert.Equal("визитки — 500 шт", CustomerOrderKey.BuildOrderTitle("визитки.cdr", "500 шт", "Арета"));
        Assert.Equal("визитки", CustomerOrderKey.BuildOrderTitle("визитки.cdr", "", "Арета"));
        Assert.Equal("Арета", CustomerOrderKey.BuildOrderTitle("", "", "Арета"));
    }

    [Theory]
    [InlineData(JobStatus.Assigned, "В очереди", "queued")]
    [InlineData(JobStatus.Waiting, "В очереди", "queued")]
    [InlineData(JobStatus.InProgress, "В работе", "inProgress")]
    [InlineData(JobStatus.Paused, "В работе", "inProgress")]
    [InlineData(JobStatus.Completed, "Готов к выдаче", "ready")]
    public void PublicStatus_Maps(JobStatus status, string label, string kind)
    {
        var (mappedLabel, mappedKind) = CustomerOrderPublicStatus.Map(status);
        Assert.Equal(label, mappedLabel);
        Assert.Equal(kind, mappedKind);
    }
}
