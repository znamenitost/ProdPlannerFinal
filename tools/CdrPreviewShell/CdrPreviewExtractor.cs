using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;

namespace CdrPreviewShell;

internal static class CdrPreviewExtractor
{
    private static readonly Regex[] ZipPreviewPatterns =
    {
        new Regex(@"^previews/thumbnail\.png$", RegexOptions.IgnoreCase),
        new Regex(@"^metadata/thumbnails/thumbnail\.bmp$", RegexOptions.IgnoreCase),
        new Regex(@"^previews/thumbnail\.bmp$", RegexOptions.IgnoreCase),
        new Regex(@"^metadata/thumbnails/thumbnail\.png$", RegexOptions.IgnoreCase),
        new Regex(@"^previews/page1\.png$", RegexOptions.IgnoreCase),
        new Regex(@"^metadata/thumbnails/page1\.bmp$", RegexOptions.IgnoreCase),
        new Regex(@"thumbnail.*\.(png|bmp|jpg|jpeg)$", RegexOptions.IgnoreCase)
    };

    public static Bitmap? ExtractBitmap(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            return null;

        var bytes = File.ReadAllBytes(filePath);
        return ExtractBitmap(bytes);
    }

    public static Bitmap? ExtractBitmap(byte[] bytes)
    {
        if (bytes.Length < 4)
            return null;

        if (bytes[0] == 0x50 && bytes[1] == 0x4B)
            return FromZip(bytes);

        if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46)
        {
            var disp = ExtractFromDisp(bytes);
            if (disp != null)
                return disp;

            var bmp = FindBmpInBuffer(bytes, 256 * 1024);
            if (bmp != null)
                return LoadImageBytes(bmp);
        }
        else
        {
            var bmp = FindBmpInBuffer(bytes, 256 * 1024);
            if (bmp != null)
                return LoadImageBytes(bmp);
        }

        return null;
    }

    private static Bitmap? FromZip(byte[] bytes)
    {
        try
        {
            using var stream = new MemoryStream(bytes, writable: false);
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

            var names = archive.Entries
                .Where(e => !string.IsNullOrEmpty(e.Name))
                .Select(e => e.FullName.Replace('\\', '/'))
                .ToList();

            foreach (var pattern in ZipPreviewPatterns)
            {
                var entryName = names.FirstOrDefault(n => pattern.IsMatch(n));
                if (entryName == null)
                    continue;

                var entry = archive.GetEntry(entryName) ?? archive.Entries.FirstOrDefault(e =>
                    e.FullName.Replace('\\', '/').Equals(entryName, StringComparison.OrdinalIgnoreCase));
                if (entry == null)
                    continue;

                using var entryStream = entry.Open();
                using var ms = new MemoryStream();
                entryStream.CopyTo(ms);
                var data = ms.ToArray();
                if (data.Length > 100)
                    return LoadImageBytes(data);
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static Bitmap? ExtractFromDisp(byte[] bytes)
    {
        if (bytes.Length < 12)
            return null;

        var offset = 12;
        while (offset + 8 <= bytes.Length)
        {
            var id = EncodingAscii(bytes, offset, 4);
            var size = BitConverter.ToUInt32(bytes, offset + 4);
            var dataStart = offset + 8;
            var dataEnd = dataStart + (int)size;

            if (id == "DISP" && dataEnd <= bytes.Length && size > 44)
            {
                var w = (int)BitConverter.ToUInt32(bytes, dataStart + 8);
                var h = (int)BitConverter.ToUInt32(bytes, dataStart + 12);
                var paletteStart = dataStart + 8 + 4 + 4 + 28;
                var pixelsStart = paletteStart + 1024;

                if (w > 0 && h > 0 && w < 4096 && h < 4096 && pixelsStart + (w * h) <= dataEnd)
                {
                    var bitmap = new Bitmap(w, h, PixelFormat.Format32bppArgb);
                    for (var y = 0; y < h; y++)
                    {
                        for (var x = 0; x < w; x++)
                        {
                            var p = y * w + x;
                            var idx = bytes[pixelsStart + p] * 4;
                            var r = bytes[paletteStart + idx + 2];
                            var g = bytes[paletteStart + idx + 1];
                            var b = bytes[paletteStart + idx];
                            bitmap.SetPixel(x, y, Color.FromArgb(255, r, g, b));
                        }
                    }

                    return bitmap;
                }
            }

            offset = dataEnd + (int)(size % 2);
            if (offset <= 12)
                break;
        }

        return null;
    }

    private static byte[]? FindBmpInBuffer(byte[] bytes, int maxScan)
    {
        var limit = Math.Min(maxScan, bytes.Length);
        for (var i = 0; i < limit - 6; i++)
        {
            if (bytes[i] == 0x42 && bytes[i + 1] == 0x4D)
            {
                var size = BitConverter.ToInt32(bytes, i + 2);
                if (size > 1000 && size < bytes.Length - i)
                    return bytes.Skip(i).Take(size).ToArray();
            }
        }

        return null;
    }

    private static Bitmap? LoadImageBytes(byte[] data)
    {
        try
        {
            using var ms = new MemoryStream(data);
            using var image = Image.FromStream(ms);
            return new Bitmap(image);
        }
        catch
        {
            return null;
        }
    }

    private static string EncodingAscii(byte[] bytes, int offset, int count)
    {
        return System.Text.Encoding.ASCII.GetString(bytes, offset, count);
    }
}
