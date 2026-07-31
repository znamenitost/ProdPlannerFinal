using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Options;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace ProductionPlanner.Services.Catalog;

/// <summary>
/// Removes image backgrounds with a local IS-Net (isnet-general-use) ONNX model.
/// Mirrors the rembg pipeline: 1024² LANCZOS resize, /max then 0.5-mean normalization,
/// min-max mask scaling, mask-as-alpha cutout.
/// </summary>
public sealed class IsNetBackgroundRemovalService : IBackgroundRemovalService, IDisposable
{
    private readonly BackgroundRemovalOptions _options;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<IsNetBackgroundRemovalService> _logger;

    // Session creation is retried on every call until it succeeds: a failure
    // during deploy (file mid-upload, pool recycle) must not poison the
    // singleton for the process lifetime.
    private readonly object _sessionLock = new();
    private InferenceSession? _session;
    private string? _lastLoadError;

    // IS-Net runs on the shared hosting CPU pool — serialize inference so one
    // heavy request can't starve the whole site.
    private readonly SemaphoreSlim _inferenceLock = new(1, 1);

    public IsNetBackgroundRemovalService(
        IOptions<BackgroundRemovalOptions> options,
        IWebHostEnvironment env,
        ILogger<IsNetBackgroundRemovalService> logger)
    {
        _options = options.Value;
        _env = env;
        _logger = logger;
    }

    public async Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        Action<double, string>? reportProgress,
        CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length == 0)
            return new BackgroundRemovalResult(false, null, "Пустое изображение");

        if (imageBytes.Length > _options.MaxUploadBytes)
            return new BackgroundRemovalResult(false, null, "Файл слишком большой (макс. 5 МБ)");

        var mime = NormalizeMime(contentType);
        if (mime is null)
            return new BackgroundRemovalResult(false, null, "Поддерживаются PNG, JPEG и WebP");

        var session = TryGetSession();
        if (session is null)
            return new BackgroundRemovalResult(false, null, _lastLoadError ?? "Модель IS-Net не найдена (models/isnet-general-use.onnx)");

        try
        {
            return await Task.Run(
                () => RunPipeline(session, imageBytes, reportProgress, cancellationToken),
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IS-Net background removal failed");
            return new BackgroundRemovalResult(false, null, "Не удалось обработать изображение локально");
        }
    }

    public Task<BackgroundRemovalDiagnostics> DiagnoseAsync(CancellationToken cancellationToken = default)
    {
        var modelPath = ResolveModelPath();
        var sw = System.Diagnostics.Stopwatch.StartNew();

        if (!File.Exists(modelPath))
        {
            return Task.FromResult(new BackgroundRemovalDiagnostics(
                modelPath, false, false, null, 0, "Config",
                "Файл модели не найден — положите models/isnet-general-use.onnx"));
        }

        var session = TryGetSession();
        sw.Stop();
        return session is not null
            ? Task.FromResult(new BackgroundRemovalDiagnostics(modelPath, false, true, null, sw.ElapsedMilliseconds, null, null))
            : Task.FromResult(new BackgroundRemovalDiagnostics(modelPath, false, false, null, sw.ElapsedMilliseconds,
                "Load", _lastLoadError ?? "Не удалось инициализировать ONNX-сессию (см. логи)"));
    }

    private BackgroundRemovalResult RunPipeline(
        InferenceSession session,
        byte[] imageBytes,
        Action<double, string>? progress,
        CancellationToken cancellationToken)
    {
        progress?.Invoke(3, "Декодирую изображение");
        using var image = Image.Load<Rgba32>(imageBytes);
        if ((long)image.Width * image.Height > _options.MaxPixels)
            return new BackgroundRemovalResult(false, null, "Изображение слишком большое для локальной обработки");

        var width = image.Width;
        var height = image.Height;

        progress?.Invoke(10, "Готовлю вход для модели");
        var size = _options.InputSize;
        // rembg composites RGBA onto white before inference; feeding the raw
        // RGB of transparent pixels (usually black) makes transparent logos
        // black-on-black and segments to nothing.
        using var flattened = image.Clone(ctx => ctx.BackgroundColor(Color.White));
        using var resized = flattened.Clone(ctx => ctx.Resize(size, size, KnownResamplers.Lanczos3));

        var input = new DenseTensor<float>(new[] { 1, 3, size, size });
        resized.ProcessPixelRows(accessor =>
        {
            // rembg: scale by the brightest pixel before mean-std normalization
            var max = 0f;
            for (var y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < size; x++)
                {
                    max = Math.Max(max, Math.Max(row[x].R, Math.Max(row[x].G, row[x].B)));
                }
            }

            var scale = 1f / Math.Max(max, 1e-6f);
            for (var y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < size; x++)
                {
                    input[0, 0, y, x] = row[x].R * scale - 0.5f;
                    input[0, 1, y, x] = row[x].G * scale - 0.5f;
                    input[0, 2, y, x] = row[x].B * scale - 0.5f;
                }
            }
        });

        progress?.Invoke(20, "Модель обрабатывает изображение");
        using var inferenceTicker = StartInferenceTicker(progress);

        _inferenceLock.Wait(cancellationToken);
        float[] logits;
        try
        {
            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(session.InputMetadata.Keys.First(), input)
            };
            // Copy the tensor to managed memory inside the using scope: the
            // DenseTensor wraps native OrtValue memory that is released when
            // the results collection is disposed at the end of the try block.
            using var results = session.Run(inputs);
            logits = results[0].AsTensor<float>().ToArray();
        }
        finally
        {
            _inferenceLock.Release();
        }

        inferenceTicker.Cancel();
        cancellationToken.ThrowIfCancellationRequested();

        progress?.Invoke(88, "Строю маску");
        var mask = BuildMask(logits, size, width, height);

        progress?.Invoke(93, "Применяю маску");
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < height; y++)
            {
                var row = accessor.GetRowSpan(y);
                var maskRow = mask.AsSpan(y * width, width);
                for (var x = 0; x < width; x++)
                {
                    row[x].A = maskRow[x];
                }
            }
        });

        progress?.Invoke(97, "Кодирую PNG");
        // Force RGBA output: the default PNG encoder adaptively drops the
        // alpha channel for near-binary masks (RGB or RGB+tRNS), which makes
        // cutouts look like the background was never removed.
        using var ms = new MemoryStream();
        image.SaveAsPng(ms, new PngEncoder { ColorType = PngColorType.RgbWithAlpha });
        progress?.Invoke(100, "Готово");
        return new BackgroundRemovalResult(true, ms.ToArray(), null);
    }

    /// <summary>
    /// ORT gives no intra-run progress, so while the monolithic inference call
    /// runs we interpolate 20%→86% along the expected wall time and hold there
    /// if it overruns. Stops when the returned token source is disposed.
    /// </summary>
    private CancellationTokenSource StartInferenceTicker(Action<double, string>? progress)
    {
        var cts = new CancellationTokenSource();
        if (progress is null)
            return cts;

        var expectedMs = Math.Max(_options.InferenceExpectedMs, 4000);
        var sw = Stopwatch.StartNew();
        _ = Task.Run(async () =>
        {
            try
            {
                while (!cts.IsCancellationRequested)
                {
                    await Task.Delay(700, cts.Token);
                    var ratio = Math.Min(sw.Elapsed.TotalMilliseconds / expectedMs, 1.0);
                    progress(20 + 66 * ratio, "Модель обрабатывает изображение");
                }
            }
            catch (OperationCanceledException) { }
        });
        return cts;
    }

    /// <summary>Min-max scale the raw 1024² logits, then Lanczos-resize back to the original size.</summary>
    private static byte[] BuildMask(float[] values, int size, int width, int height)
    {
        var min = float.MaxValue;
        var max = float.MinValue;
        foreach (var v in values)
        {
            min = Math.Min(min, v);
            max = Math.Max(max, v);
        }

        var range = Math.Max(max - min, 1e-6f);
        using var maskImage = new Image<L8>(size, size);
        maskImage.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                var offset = y * size;
                for (var x = 0; x < size; x++)
                {
                    row[x] = new L8((byte)Math.Clamp((int)((values[offset + x] - min) / range * 255f), 0, 255));
                }
            }
        });

        maskImage.Mutate(ctx => ctx.Resize(width, height, KnownResamplers.Lanczos3));

        var mask = new byte[width * height];
        maskImage.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < height; y++)
            {
                var row = accessor.GetRowSpan(y);
                var dst = mask.AsSpan(y * width, width);
                for (var x = 0; x < width; x++)
                {
                    dst[x] = row[x].PackedValue;
                }
            }
        });
        return mask;
    }

    private InferenceSession? TryGetSession()
    {
        lock (_sessionLock)
        {
            return _session ??= CreateSession();
        }
    }

    private InferenceSession? CreateSession()
    {
        var modelPath = ResolveModelPath();
        if (!File.Exists(modelPath))
        {
            _lastLoadError = $"Файл модели не найден: {modelPath}";
            _logger.LogWarning("IS-Net model not found at {Path}", modelPath);
            return null;
        }

        try
        {
            using var opts = new Microsoft.ML.OnnxRuntime.SessionOptions
            {
                ExecutionMode = ExecutionMode.ORT_SEQUENTIAL,
                GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
                IntraOpNumThreads = Math.Max(1, Math.Min(Environment.ProcessorCount, 4)),
            };
            var session = new InferenceSession(modelPath, opts);
            _lastLoadError = null;
            _logger.LogInformation("IS-Net ONNX session loaded from {Path}", modelPath);
            return session;
        }
        catch (Exception ex)
        {
            var nativeDll = Path.Combine(AppContext.BaseDirectory, "onnxruntime.dll");
            var dllInfo = File.Exists(nativeDll)
                ? $"onnxruntime.dll на месте ({new FileInfo(nativeDll).Length} байт)"
                : $"onnxruntime.dll ОТСУТСТВУЕТ в {AppContext.BaseDirectory}";
            _lastLoadError = $"Не удалось загрузить ONNX-сессию: {DescribeError(ex)}. {dllInfo}. {ProbeNativeLibraries()}";
            _logger.LogError(ex, "Failed to load IS-Net ONNX session from {Path}", modelPath);
            return null;
        }
    }

    /// <summary>
    /// Loads a few native DLLs directly to pinpoint why ORT fails on the host:
    /// control sample from the app dir (no VC deps), ORT itself, and the VC++ runtime.
    /// </summary>
    private static string ProbeNativeLibraries()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "";

        var cpu = $"cpu: sse42={(System.Runtime.Intrinsics.X86.Sse42.IsSupported ? 1 : 0)}"
            + $" avx={(System.Runtime.Intrinsics.X86.Avx.IsSupported ? 1 : 0)}"
            + $" avx2={(System.Runtime.Intrinsics.X86.Avx2.IsSupported ? 1 : 0)}"
            + $" avx512f={(System.Runtime.Intrinsics.X86.Avx512F.IsSupported ? 1 : 0)}"
            + $" | os: {Environment.OSVersion.VersionString}";

        var systemDir = Environment.GetFolderPath(Environment.SpecialFolder.System);

        // ORT >= 1.21 needs VC++ runtime >= 14.40; on older runtimes it dies
        // during init with 0x8007045A even though the DLLs "load fine" here.
        var crtVersions = new List<string>();
        foreach (var name in new[] { "msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll", "ucrtbase.dll" })
        {
            var p = Path.Combine(systemDir, name);
            crtVersions.Add(File.Exists(p)
                ? $"{name}={FileVersionInfo.GetVersionInfo(p).FileVersion}"
                : $"{name}=missing");
        }
        var crt = "crt: " + string.Join(" ", crtVersions);
        var probes = new (string Label, string Path)[]
        {
            ("app/e_sqlite3.dll", Path.Combine(AppContext.BaseDirectory, "e_sqlite3.dll")),
            ("app/onnxruntime.dll", Path.Combine(AppContext.BaseDirectory, "onnxruntime.dll")),
            ("sys32/msvcp140.dll", Path.Combine(systemDir, "msvcp140.dll")),
            ("sys32/vcruntime140_1.dll", Path.Combine(systemDir, "vcruntime140_1.dll")),
            ("sys32/ucrtbase.dll", Path.Combine(systemDir, "ucrtbase.dll")),
        };

        var parts = new List<string>();
        foreach (var (label, path) in probes)
        {
            if (!File.Exists(path))
            {
                parts.Add($"{label}: файла нет");
                continue;
            }

            try
            {
                NativeLibrary.Load(path);
                parts.Add($"{label}: OK");
            }
            catch (Exception ex)
            {
                parts.Add($"{label}: FAIL {ex.Message}");
            }
        }
        return cpu + " | " + crt + " | probe: " + string.Join("; ", parts);
    }

    private static string DescribeError(Exception ex)
    {
        var parts = new List<string>();
        for (var cur = ex; cur is not null; cur = cur.InnerException)
        {
            parts.Add($"{cur.GetType().Name}: {cur.Message}");
        }
        return string.Join(" → ", parts);
    }

    private string ResolveModelPath()
    {
        var path = _options.ModelPath;
        if (string.IsNullOrWhiteSpace(path))
            path = "models/isnet-general-use.onnx";
        return Path.IsPathRooted(path) ? path : Path.Combine(_env.ContentRootPath, path);
    }

    private static string? NormalizeMime(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return "image/png";
        var mime = contentType.Split(';')[0].Trim().ToLowerInvariant();
        return mime switch
        {
            "image/png" => "image/png",
            "image/jpeg" or "image/jpg" => "image/jpeg",
            "image/webp" => "image/webp",
            _ => null
        };
    }

    public void Dispose()
    {
        lock (_sessionLock)
        {
            _session?.Dispose();
            _session = null;
        }
        _inferenceLock.Dispose();
    }
}
