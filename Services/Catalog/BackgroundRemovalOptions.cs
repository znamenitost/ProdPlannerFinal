namespace ProductionPlanner.Services.Catalog;

public sealed class BackgroundRemovalOptions
{
    public const string SectionName = "BackgroundRemoval";

    /// <summary>
    /// When false, IS-Net is not loaded and remove-background APIs refuse work.
    /// Keep true locally; disable on shared hosting to avoid ~170 MB RAM pressure.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Path to the local IS-Net (isnet-general-use) ONNX model, relative to content root.</summary>
    public string ModelPath { get; set; } = "models/isnet-general-use.onnx";

    /// <summary>Max upload size in bytes (default 5 MB).</summary>
    public int MaxUploadBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>Model input size (isnet-general-use expects 1024×1024).</summary>
    public int InputSize { get; set; } = 1024;

    /// <summary>Skip background removal for images above this many total pixels (CPU safety valve on shared hosting).</summary>
    public long MaxPixels { get; set; } = 12_000_000;

    /// <summary>
    /// Typical inference wall time on the production host; used only to
    /// interpolate the progress bar while the monolithic ORT call runs.
    /// </summary>
    public int InferenceExpectedMs { get; set; } = 16000;
}
