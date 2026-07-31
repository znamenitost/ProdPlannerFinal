using System.Diagnostics;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;

namespace ProductionPlanner.Services.Catalog;

/// <summary>Converts a raster logo to SVG using the local vtracer CLI.</summary>
public sealed class VTracerLogoVectorizationService : ILogoVectorizationService, IDisposable
{
    private readonly LogoVectorizationOptions _options;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<VTracerLogoVectorizationService> _logger;
    private readonly SemaphoreSlim _vectorizationLock = new(1, 1);

    public VTracerLogoVectorizationService(
        IOptions<LogoVectorizationOptions> options,
        IWebHostEnvironment env,
        ILogger<VTracerLogoVectorizationService> logger)
    {
        _options = options.Value;
        _env = env;
        _logger = logger;
    }

    public async Task<LogoVectorizationResult> VectorizeAsync(
        byte[] imageBytes,
        CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length == 0)
            return new LogoVectorizationResult(false, null, "Пустое изображение");
        if (imageBytes.Length > _options.MaxUploadBytes)
            return new LogoVectorizationResult(false, null, "Файл слишком большой (макс. 5 МБ)");

        var executablePath = ResolveExecutablePath();
        if (!File.Exists(executablePath))
        {
            _logger.LogError("vtracer executable not found at {Path}", executablePath);
            return new LogoVectorizationResult(false, null, "VTracer не установлен на сервере");
        }

        var tempDirectory = Path.Combine(Path.GetTempPath(), "ProductionPlanner", "vtracer");
        Directory.CreateDirectory(tempDirectory);
        var operationId = Guid.NewGuid().ToString("N");
        var inputPath = Path.Combine(tempDirectory, $"{operationId}.png");
        var outputPath = Path.Combine(tempDirectory, $"{operationId}.svg");

        try
        {
            using (var image = Image.Load<Rgba32>(imageBytes))
            {
                if ((long)image.Width * image.Height > _options.MaxPixels)
                    return new LogoVectorizationResult(false, null, "Изображение слишком большое для векторизации");

                await image.SaveAsPngAsync(
                    inputPath,
                    new PngEncoder { ColorType = PngColorType.RgbWithAlpha },
                    cancellationToken);
            }

            await _vectorizationLock.WaitAsync(cancellationToken);
            try
            {
                var result = await RunVTracerAsync(executablePath, inputPath, outputPath, cancellationToken);
                if (!result.Success)
                    return result;
            }
            finally
            {
                _vectorizationLock.Release();
            }

            if (!File.Exists(outputPath))
                return new LogoVectorizationResult(false, null, "VTracer не создал SVG");

            var svg = await File.ReadAllBytesAsync(outputPath, cancellationToken);
            if (svg.Length == 0)
                return new LogoVectorizationResult(false, null, "VTracer создал пустой SVG");
            if (svg.Length > 10 * 1024 * 1024)
                return new LogoVectorizationResult(false, null, "Получившийся SVG слишком большой");

            return new LogoVectorizationResult(true, svg, null);
        }
        catch (UnknownImageFormatException)
        {
            return new LogoVectorizationResult(false, null, "Поддерживаются PNG, JPEG и WebP");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new LogoVectorizationResult(false, null, "Векторизация превысила лимит времени");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "VTracer logo vectorization failed");
            return new LogoVectorizationResult(false, null, "Не удалось преобразовать логотип в SVG");
        }
        finally
        {
            TryDelete(inputPath);
            TryDelete(outputPath);
        }
    }

    private async Task<LogoVectorizationResult> RunVTracerAsync(
        string executablePath,
        string inputPath,
        string outputPath,
        CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = executablePath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        foreach (var argument in new[]
        {
            inputPath,
            outputPath,
            "--preset", "poster",
            "--mode", "spline",
            "--hierarchical", "cutout",
            "--max-colors", Math.Clamp(_options.MaxColors, 2, 64).ToString(),
            "--filter-speckle", "1",
            "--optimize", "2",
        })
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = new Process { StartInfo = startInfo };
        if (!process.Start())
            return new LogoVectorizationResult(false, null, "Не удалось запустить VTracer");

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 5, 180)));

        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch
        {
            TryKill(process);
            throw;
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        if (process.ExitCode == 0)
            return new LogoVectorizationResult(true, Array.Empty<byte>(), null);

        _logger.LogWarning(
            "VTracer exited with code {ExitCode}. stdout: {Stdout}; stderr: {Stderr}",
            process.ExitCode,
            stdout,
            stderr);
        return new LogoVectorizationResult(false, null, "VTracer не смог обработать изображение");
    }

    private string ResolveExecutablePath()
    {
        var path = string.IsNullOrWhiteSpace(_options.ExecutablePath)
            ? "tools/vtracer/vtracer.exe"
            : _options.ExecutablePath;
        return Path.IsPathRooted(path) ? path : Path.Combine(_env.ContentRootPath, path);
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
        }
        catch
        {
            // Best effort during cancellation/timeout.
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch
        {
            // Temp-file cleanup must not hide a successful conversion.
        }
    }

    public void Dispose() => _vectorizationLock.Dispose();
}
