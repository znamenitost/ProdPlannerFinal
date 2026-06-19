using ProductionPlanner.Services;
using Xunit;

namespace ProductionPlanner.Tests;

public class FilePathNormalizerTests
{
    private const string Share = "Клиенты";

    [Fact]
    public void Strips_windows_path_before_share()
    {
        var input = "C:/Users/пк/Yandex.Disk/Клиенты/Ф/Фрэшмемори/18,05,26 конфеты.cdr";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Фрэшмемори/18,05,26 конфеты.cdr", result);
    }

    [Fact]
    public void Strips_e_drive_yandex_path()
    {
        var input = @"E:\Users\User\YandexDisk\YandexDisk\Клиенты\Ф\Фрешмемори\18,05,26 конфеты.cdr";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Фрешмемори/18,05,26 конфеты.cdr", result);
    }

    [Fact]
    public void Keeps_relative_path_under_share()
    {
        var input = "Клиенты/Ф/Фрэшмемори/18,05,26 конфеты";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Фрэшмемори/18,05,26 конфеты.cdr", result);
    }

    [Fact]
    public void BuildSmbUrl_uses_lowercase_host()
    {
        var url = FilePathNormalizer.BuildSmbUrl("MINIMARKER", Share, "Ф/Фрэшмемори/file.cdr", encodePath: false);
        Assert.Equal("smb://minimarker/Клиенты/Ф/Фрэшмемори/file.cdr", url);
    }

    [Fact]
    public void BuildSmbUrl_encodes_commas_in_filename()
    {
        var url = FilePathNormalizer.BuildSmbUrl("minimarker", Share, "С/Спортмебель/15,05,26 спортт.cdr", encodePath: true);
        Assert.Contains("15%2C05%2C26", url);
        Assert.EndsWith("%D1%81%D0%BF%D0%BE%D1%80%D1%82%D1%82.cdr", url);
    }

    [Fact]
    public void GetWindowsServerHost_AlwaysUsesNetworkPcName()
    {
        Assert.Equal("MINIMARKER", FilePathNormalizer.GetWindowsServerHost("192.168.1.119"));
        Assert.Equal("MINIMARKER", FilePathNormalizer.GetWindowsServerHost(null));
    }

    [Fact]
    public void BuildWindowsFileUrl_encodes_path_for_file_protocol()
    {
        var host = FilePathNormalizer.GetWindowsServerHost("192.168.1.119");
        var url = FilePathNormalizer.BuildWindowsFileUrl(host, Share, "С/Спортмебель/15,05,26 спортт.cdr");
        Assert.StartsWith("file://MINIMARKER/", url);
        Assert.Contains("15%2C05%2C26", url);
    }

    [Fact]
    public void BuildWindowsUncPath_matches_server_layout()
    {
        var host = FilePathNormalizer.GetWindowsServerHost("192.168.1.119");
        var unc = FilePathNormalizer.BuildWindowsUncPath(host, Share, "С/Спортмебель/15,05,26 спортт.cdr");
        Assert.Equal(@"\\MINIMARKER\Клиенты\С\Спортмебель\15,05,26 спортт.cdr", unc);
    }

    [Fact]
    public void Rejects_path_with_parent_directory_segments()
    {
        var ok = FilePathNormalizer.TryNormalizeRelativePath(
            "Клиенты/Ф/../secret/file.cdr",
            Share,
            out _,
            out var error);

        Assert.False(ok);
        Assert.Equal("Недопустимый путь", error);
    }

    [Fact]
    public void Prepends_letter_bucket_when_path_lacks_share_letter_segment()
    {
        var input = "Федерация Бодибилдинга/макет.cdr";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Федерация Бодибилдинга/макет.cdr", result);
    }

    [Fact]
    public void Prepends_letter_after_stripping_yandex_disk_path_without_letter_folder()
    {
        var input = @"C:\Users\пк\Yandex.Disk\Клиенты\Федерация Бодибилдинга\макет.cdr";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Федерация Бодибилдинга/макет.cdr", result);
    }

    [Fact]
    public void Keeps_path_when_letter_bucket_already_present()
    {
        var input = @"C:\Users\пк\Yandex.Disk\Клиенты\Ф\Федерация Бодибилдинга\макет.cdr";
        var result = FilePathNormalizer.NormalizeRelativePath(input, Share);
        Assert.Equal("Ф/Федерация Бодибилдинга/макет.cdr", result);
    }

    [Fact]
    public void IsEligibleForCdrPreview_appends_cdr_when_extension_missing()
    {
        Assert.True(FilePathNormalizer.IsEligibleForCdrPreview("Федерация Бодибилдинга", "11,06,26 тт", Share));
    }

    [Fact]
    public void IsEligibleForCdrPreview_rejects_non_cdr_extension()
    {
        Assert.False(FilePathNormalizer.IsEligibleForCdrPreview("Клиент/2024", "layout.ai", Share));
    }
}
