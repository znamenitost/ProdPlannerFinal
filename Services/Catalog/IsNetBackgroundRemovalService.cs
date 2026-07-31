using Microsoft.Extensions.Options;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
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
    private readonly Lazy<InferenceSession?> _session;

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
        _session = new Lazy<InferenceSession?>(CreateSession);
    }

    public async Task<BackgroundRemovalResult> RemoveBackgroundAsync(
        byte[] imageBytes,
        string contentType,
        string? fileName,
        CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length == 0)
            return new BackgroundRemovalResult(false, null, "Пустое изображение");

        if (imageBytes.Length > _options.MaxUploadBytes)
            return new BackgroundRemovalResult(false, null, "Файл слишком большой (макс. 5 МБ)");

        var mime = NormalizeMime(contentType);
        if (mime is null)
            return new BackgroundRemovalResult(false, null, "Поддерживаются PNG, JPEG и WebP");

        var session = _session.Value;
        if (session is null)
            return new BackgroundRemovalResult(false, null, "Модель IS-Net не найдена (models/isnet-general-use.onnx)");

        try
        {
            return await Task.Run(
                () => RunPipeline(session, imageBytes, cancellationToken),
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

        var session = _session.Value;
        sw.Stop();
        return session is not null
            ? Task.FromResult(new BackgroundRemovalDiagnostics(modelPath, false, true, null, sw.ElapsedMilliseconds, null, null))
            : Task.FromResult(new BackgroundRemovalDiagnostics(modelPath, false, false, null, sw.ElapsedMilliseconds,
                "Load", "Не удалось инициализировать ONNX-сессию (см. логи)"));
    }

    private BackgroundRemovalResult RunPipeline(
        InferenceSession session,
        byte[] imageBytes,
        CancellationToken cancellationToken)
    {
        using var image = Image.Load<Rgba32>(imageBytes);
        if ((long)image.Width * image.Height > _options.MaxPixels)
            return new BackgroundRemovalResult(false, null, "Изображение слишком большое для локальной обработки");

        var width = image.Width;
        var height = image.Height;

        var size = _options.InputSize;
        using var resized = image.Clone(ctx => ctx.Resize(size, size, KnownResamplers.Lanczos3));

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

            var scale = 1f / Math.Max(max, 1e-6f) / 255f;
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

        _inferenceLock.Wait(cancellationToken);
        Tensor<float> output;
        try
        {
            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(session.InputMetadata.Keys.First(), input)
            };
            using var results = session.Run(inputs);
            output = results[0].AsTensor<float>();
        }
        finally
        {
            _inferenceLock.Release();
        }

        cancellationToken.ThrowIfCancellationRequested();

        var mask = BuildMask(output, size, width, height);

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

        using var ms = new MemoryStream();
        image.SaveAsPng(ms);
        return new BackgroundRemovalResult(true, ms.ToArray(), null);
    }

    /// <summary>Min-max scale the raw 1024² logits, then Lanczos-resize back to the original size.</summary>
    private static byte[] BuildMask(Tensor<float> output, int size, int width, int height)
    {
        var values = output.ToArray();
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

    private InferenceSession? CreateSession()
    {
        var modelPath = ResolveModelPath();
        if (!File.Exists(modelPath))
        {
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
            return new InferenceSession(modelPath, opts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load IS-Net ONNX session from {Path}", modelPath);
            return null;
        }
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
        if (_session.IsValueCreated)
            _session.Value?.Dispose();
        _inferenceLock.Dispose();
    }
}
