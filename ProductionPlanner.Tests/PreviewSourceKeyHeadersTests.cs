using Microsoft.AspNetCore.Http;
using ProductionPlanner.Services.TaskCdrPreview;

namespace ProductionPlanner.Tests;

public class PreviewSourceKeyHeadersTests
{
    [Fact]
    public void Apply_encodes_unicode_unc_path_for_http_headers()
    {
        var context = new DefaultHttpContext();
        var path = @"\\MINIMARKER\Клиенты\folder\test.cdr";

        PreviewSourceKeyHeaders.Apply(context.Response, path);

        var encoded = context.Response.Headers[PreviewSourceKeyHeaders.SourceKeyHeader].ToString();
        var encoding = context.Response.Headers[PreviewSourceKeyHeaders.EncodingHeader].ToString();

        Assert.NotEqual(path, encoded);
        Assert.Equal(PreviewSourceKeyHeaders.Base64Encoding, encoding);
        Assert.Equal(path, PreviewSourceKeyHeaders.Decode(encoded, encoding));
    }

    [Fact]
    public void Decode_returns_plain_ascii_when_encoding_header_missing()
    {
        const string ascii = "C:\\folder\\file.cdr";
        Assert.Equal(ascii, PreviewSourceKeyHeaders.Decode(ascii, null));
    }
}
