using System.Diagnostics;
using System.Net;
using System.Text;
using System.Threading;

const int DefaultPort = 17888;
const string DefaultHost = "127.0.0.1";
const string AllowedUncPrefix = @"\\MINIMARKER\Клиенты\";

using var mutex = new Mutex(true, "ProductionPlanner.FileOpener", out var createdNew);
if (!createdNew)
    return;

var port = DefaultPort;
if (int.TryParse(Environment.GetEnvironmentVariable("PP_FILE_OPENER_PORT"), out var envPort) && envPort is > 0 and < 65536)
    port = envPort;

using var listener = new HttpListener();
listener.Prefixes.Add($"http://{DefaultHost}:{port}/");
try
{
    listener.Start();
}
catch (HttpListenerException ex)
{
    Trace.TraceError("File opener failed to listen on {0}:{1}: {2}", DefaultHost, port, ex.Message);
    return;
}

Trace.WriteLine($"ProductionPlanner File Opener: http://{DefaultHost}:{port}/open?path=...");

while (true)
{
    var ctx = await listener.GetContextAsync();
    _ = Task.Run(() => HandleRequest(ctx));
}

static void HandleRequest(HttpListenerContext ctx)
{
    AddCors(ctx.Response);

    if (ctx.Request.HttpMethod == "OPTIONS")
    {
        ctx.Response.StatusCode = 204;
        ctx.Response.Close();
        return;
    }

    var path = ctx.Request.Url?.AbsolutePath ?? "";
    try
    {
        switch (path)
        {
            case "/health":
                WriteText(ctx, 200, "ok");
                break;
            case "/capabilities":
                WriteText(ctx, 200, "open,open-dev,read-dev,read-on-open-dev");
                break;
            case "/open":
                HandleOpen(ctx, IsAllowedPath, "path not allowed");
                break;
            case "/open-dev":
                HandleOpen(ctx, IsAllowedDevPath, "dev path not allowed", allowRead: true, readAllowed: IsAllowedReadPath);
                break;
            case "/read-dev":
                HandleReadDev(ctx);
                break;
            default:
                WriteText(ctx, 404, "not found");
                break;
        }
    }
    catch (Exception ex)
    {
        WriteText(ctx, 500, ex.Message);
    }
}

static void HandleOpen(
    HttpListenerContext ctx,
    Func<string, bool> isAllowed,
    string deniedMessage,
    bool allowRead = false,
    Func<string, bool>? readAllowed = null)
{
    var raw = ctx.Request.QueryString["path"];
    if (string.IsNullOrWhiteSpace(raw))
    {
        WriteText(ctx, 400, "missing path");
        return;
    }

    var filePath = Uri.UnescapeDataString(raw).Trim();
    var readMode = allowRead
        && string.Equals(ctx.Request.QueryString["read"], "1", StringComparison.Ordinal);
    var allowed = readMode ? (readAllowed ?? isAllowed)(filePath) : isAllowed(filePath);
    if (!allowed)
    {
        WriteText(ctx, 403, deniedMessage);
        return;
    }

    if (!File.Exists(filePath))
    {
        WriteText(ctx, 404, "file not found");
        return;
    }

    if (readMode)
    {
        WriteBytes(ctx, File.ReadAllBytes(filePath));
        return;
    }

    Process.Start(new ProcessStartInfo(filePath) { UseShellExecute = true });
    WriteText(ctx, 200, "ok");
}

static void HandleReadDev(HttpListenerContext ctx)
{
    var raw = ctx.Request.QueryString["path"];
    if (string.IsNullOrWhiteSpace(raw))
    {
        WriteText(ctx, 400, "missing path");
        return;
    }

    var filePath = Uri.UnescapeDataString(raw).Trim();
    if (!IsAllowedReadPath(filePath))
    {
        WriteText(ctx, 403, "read path not allowed");
        return;
    }

    if (!File.Exists(filePath))
    {
        WriteText(ctx, 404, "file not found");
        return;
    }

    WriteBytes(ctx, File.ReadAllBytes(filePath));
}

static void WriteBytes(HttpListenerContext ctx, byte[] bytes)
{
    ctx.Response.StatusCode = 200;
    ctx.Response.ContentType = "application/octet-stream";
    ctx.Response.ContentLength64 = bytes.Length;
    ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
    ctx.Response.Close();
}

static bool IsAllowedPath(string path) =>
    IsAllowedUncPath(path);

static bool IsAllowedReadPath(string path) =>
    IsAllowedUncPath(path) || IsAllowedDevPath(path);

static bool IsAllowedDevPath(string path)
{
    if (path.Contains("..", StringComparison.Ordinal))
        return false;

    string fullPath;
    try
    {
        fullPath = Path.GetFullPath(path);
    }
    catch
    {
        return false;
    }

    if (!fullPath.StartsWith(@"C:\", StringComparison.OrdinalIgnoreCase))
        return false;

    var fileName = Path.GetFileName(fullPath);
    if (string.IsNullOrEmpty(fileName))
        return false;

    return HasSupportedExtension(fileName);
}

static bool IsAllowedUncPath(string path)
{
    if (!path.StartsWith(@"\\", StringComparison.Ordinal))
        return false;
    if (!path.StartsWith(AllowedUncPrefix, StringComparison.OrdinalIgnoreCase))
        return false;
    if (path.Contains("..", StringComparison.Ordinal))
        return false;

    return HasSupportedExtension(path);
}

static bool HasSupportedExtension(string path)
{
    var ext = Path.GetExtension(path);
    return ext.Equals(".cdr", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".ai", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".eps", StringComparison.OrdinalIgnoreCase);
}

static void AddCors(HttpListenerResponse response)
{
    response.Headers["Access-Control-Allow-Origin"] = "*";
    response.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
}

static void WriteText(HttpListenerContext ctx, int statusCode, string text)
{
    var bytes = Encoding.UTF8.GetBytes(text);
    ctx.Response.StatusCode = statusCode;
    ctx.Response.ContentType = "text/plain; charset=utf-8";
    ctx.Response.ContentLength64 = bytes.Length;
    ctx.Response.OutputStream.Write(bytes);
    ctx.Response.Close();
}
