using System.Text;
using Microsoft.AspNetCore.Http;

namespace ProductionPlanner.Services.TaskCdrPreview;

public static class PreviewSourceKeyHeaders
{
    public const string SourceKeyHeader = "X-Preview-Source-Key";
    public const string EncodingHeader = "X-Preview-Source-Key-Encoding";
    public const string Base64Encoding = "base64";

    public static void Apply(HttpResponse response, string? sourceKey)
    {
        if (string.IsNullOrEmpty(sourceKey))
            return;

        // HTTP/1.1 header values must be ASCII; UNC paths may contain Unicode.
        response.Headers[SourceKeyHeader] = Convert.ToBase64String(Encoding.UTF8.GetBytes(sourceKey));
        response.Headers[EncodingHeader] = Base64Encoding;
    }

    public static string Decode(string? headerValue, string? encoding)
    {
        if (string.IsNullOrEmpty(headerValue))
            return string.Empty;

        if (!string.Equals(encoding, Base64Encoding, StringComparison.OrdinalIgnoreCase))
            return headerValue;

        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(headerValue));
        }
        catch (FormatException)
        {
            return headerValue;
        }
    }
}
