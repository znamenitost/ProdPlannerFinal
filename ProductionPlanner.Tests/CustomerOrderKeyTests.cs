using ProductionPlanner.Models;
using ProductionPlanner.Services;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Tests;

public class CustomerOrderKeyTests
{
    [Theory]
    [InlineData("А/Арета", "Арета", "арета")]
    [InlineData("Клиенты/А/Арета", "Арета", "арета")]
    [InlineData("Д/Дистри", "Дистри", "дистри")]
    [InlineData("Фрэшмемори", "Фрэшмемори", "фрэшмемори")]
    // Заказчик — папка сразу после буквенного указателя, вложенные папки не влияют.
    [InlineData("Клиенты/И/Игорь/Визитки", "Игорь", "игорь")]
    [InlineData("И/Игорь/Проект24/Черновики", "Игорь", "игорь")]
    [InlineData("Клиенты\\И\\Игорь\\Визитки", "Игорь", "игорь")]
    public void TryGetDisplayName_And_Key(string path, string display, string key)
    {
        Assert.Equal(display, CustomerOrderKey.TryGetDisplayName(path));
        Assert.Equal(key, CustomerOrderKey.TryGetNormalizedKey(path));
        Assert.True(CustomerOrderKey.Matches(path, key));
    }

    [Fact]
    public void TryGetLetterIndex_ReturnsAlphabetFolder()
    {
        Assert.Equal("И", CustomerOrderKey.TryGetLetterIndex("Клиенты/И/Игорь"));
        Assert.Equal("А", CustomerOrderKey.TryGetLetterIndex("а/Арета"));
        Assert.Null(CustomerOrderKey.TryGetLetterIndex("Фрэшмемори"));
        Assert.Null(CustomerOrderKey.TryGetLetterIndex(null));
    }

    // Якорь «Клиенты» может быть в середине абсолютного пути — буква и заказчик
    // всё равно берутся от него, а не от последней папки проекта.
    [Theory]
    [InlineData(
        "C:\\Users\\пк\\Yandex.Disk\\Клиенты\\А\\Арт фешн групп\\600 шт",
        "Арт фешн групп",
        "арт фешн групп",
        "А")]
    [InlineData(
        "C:/Users/пк/Yandex.Disk/Клиенты/Б/Борис/Заказ 12",
        "Борис",
        "борис",
        "Б")]
    public void AbsolutePath_UsesShareAnchor(string path, string display, string key, string letterIndex)
    {
        Assert.Equal(display, CustomerOrderKey.TryGetDisplayName(path));
        Assert.Equal(key, CustomerOrderKey.TryGetNormalizedKey(path));
        Assert.Equal(letterIndex, CustomerOrderKey.TryGetLetterIndex(path));
        Assert.Equal(letterIndex[0], CustomerOrderKey.ResolvePickupLetter(path, display));
        // Поведение относительных путей не меняется.
        Assert.True(CustomerOrderKey.Matches("Клиенты/Фрэшмемори", "фрэшмемори"));
    }

    [Fact]
    public void LegacyMatches_UsesLastFolder()
    {
        Assert.True(CustomerOrderKey.LegacyMatches("Клиенты/И/Игорь/Визитки", "визитки"));
        Assert.False(CustomerOrderKey.LegacyMatches("Клиенты/И/Игорь/Визитки", "игорь"));
        Assert.Equal("визитки", CustomerOrderKey.TryGetLegacyKey("Клиенты/И/Игорь/Визитки"));
        Assert.Equal("игорь", CustomerOrderKey.TryGetLegacyKey("Клиенты/И/Игорь"));
    }

    [Fact]
    public void ResolvePickupLetter_UsesAlphabetFolder()
    {
        Assert.Equal('А', CustomerOrderKey.ResolvePickupLetter("А/Арета", "Арета"));
        Assert.Equal('Д', CustomerOrderKey.ResolvePickupLetter("Клиенты/Д/Дистри", "Дистри"));
        Assert.Equal('И', CustomerOrderKey.ResolvePickupLetter("Клиенты/И/Игорь/Визитки", "Игорь"));
    }

    [Fact]
    public void PickupCodes_Normalize_And_Allocate()
    {
        Assert.Equal("И11", PickupCodes.Normalize(" и11 "));
        Assert.Equal("", PickupCodes.Normalize(null));

        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "И00", "И01" };
        var code = PickupCodes.Allocate('И', used);
        Assert.StartsWith("И", code);
        Assert.Contains(code, used);

        Assert.True(PickupCodes.StartsWithLetter("А07", 'А'));
        Assert.True(PickupCodes.StartsWithLetter("а07", 'А'));
        Assert.False(PickupCodes.StartsWithLetter("Ш07", 'А'));
        Assert.False(PickupCodes.StartsWithLetter(null, 'А'));
    }

    [Fact]
    public void BuildOrderTitle_CombinesFileAndComment()
    {
        Assert.Equal("визитки — 500 шт", CustomerOrderKey.BuildOrderTitle("визитки.cdr", "500 шт", "Арета"));
        Assert.Equal("визитки", CustomerOrderKey.BuildOrderTitle("визитки.cdr", "", "Арета"));
        Assert.Equal("Арета", CustomerOrderKey.BuildOrderTitle("", "", "Арета"));
    }

    [Fact]
    public void ExtractPrimaryComment_TakesBaselineBlockOnly()
    {
        var sep = TaskCommentService.CommentPreviewSeparator;
        Assert.Equal(
            "визитки 500",
            CustomerOrderKey.ExtractPrimaryComment($"визитки 500{sep}Дима: ок{sep}Павел → Дима: ещё"));
        Assert.Equal(
            "только текст",
            CustomerOrderKey.ExtractPrimaryComment("→ Дима: только текст"));
        Assert.Equal("legacy", CustomerOrderKey.ExtractPrimaryComment("legacy\nДима: later"));
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
