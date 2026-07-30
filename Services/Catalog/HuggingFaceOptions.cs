namespace ProductionPlanner.Services.Catalog;

public sealed class HuggingFaceOptions
{
    public const string SectionName = "HuggingFace";

    /// <summary>HF token (hf_…). Improves Space rate limits; required for private Spaces.</summary>
    public string Token { get; set; } = "";

    /// <summary>Gradio Space base URL for background removal.</summary>
    public string SpaceBaseUrl { get; set; } = "https://briaai-bria-rmbg-2-0.hf.space";

    /// <summary>Gradio api_name (without leading slash).</summary>
    public string ApiName { get; set; } = "image";

    /// <summary>Max upload size in bytes (default 5 MB).</summary>
    public int MaxUploadBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>
    /// Optional outbound proxy for calls to the Space (e.g. "http://user:pass@host:3128"
    /// or "socks5://host:1080"). Needed when the hosting blocks direct egress to hf.space.
    /// </summary>
    public string Proxy { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Token);
}
