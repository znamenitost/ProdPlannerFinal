namespace ProductionPlanner.Services.Catalog;

public sealed class BackgroundRemovalOptions
{
    public const string SectionName = "BackgroundRemoval";

    /// <summary>Path to the local IS-Net (isnet-general-use) ONNX model, relative to content root.</summary>
    public string ModelPath { get; set; } = "models/isnet-general-use.onnx";

    /// <summary>Max upload size in bytes (default 5 MB).</summary>
    public int MaxUploadBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>Model input size (isnet-general-use expects 1024×1024).</summary>
    public int InputSize { get; set; } = 1024;

    /// <summary>Skip background removal for images above this many total pixels (CPU safety valve on shared hosting).</summary>
    public long MaxPixels { get; set; } = 12_000_000;
}
