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
    public void BuildWindowsFileUrl_encodes_path_for_file_protocol()
    {
        var url = FilePathNormalizer.BuildWindowsFileUrl("192.168.1.119", Share, "С/Спортмебель/15,05,26 спортт.cdr");
        Assert.StartsWith("file://192.168.1.119/", url);
        Assert.Contains("15%2C05%2C26", url);
    }

    [Fact]
    public void BuildWindowsUncPath_matches_server_layout()
    {
        var unc = FilePathNormalizer.BuildWindowsUncPath("192.168.1.119", Share, "С/Спортмебель/15,05,26 спортт.cdr");
        Assert.Equal(@"\\192.168.1.119\Клиенты\С\Спортмебель\15,05,26 спортт.cdr", unc);
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
}
