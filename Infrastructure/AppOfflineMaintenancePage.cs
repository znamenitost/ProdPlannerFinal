using System.Text.Json;
using Microsoft.AspNetCore.Hosting;

namespace ProductionPlanner.Infrastructure;

public static class AppOfflineMaintenancePage
{
    public const string Marker = "app-maintenance-v1";

    private const string HtmlTemplate = """
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Обновление — Mainstream Assistant</title>
  <!-- __MARKER__ -->
  <style>
    :root {
      --layer-1-x: 0px;
      --layer-1-y: 0px;
      --layer-2-x: 0px;
      --layer-2-y: 0px;
      --layer-3-x: 0px;
      --layer-3-y: 0px;
      --layer-5-x: 0px;
      --layer-5-y: 0px;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1e293b;
    }
    .page {
      position: fixed;
      inset: 0;
      min-height: 100svh;
      overflow: hidden;
      background: #d8ecfb;
    }
    .layer, .sun {
      position: absolute;
      top: 0;
      left: -5%;
      width: 110%;
      height: 105%;
      pointer-events: none;
      user-select: none;
      object-fit: cover;
      object-position: center center;
    }
    .layer {
      will-change: transform;
      transition: transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .fon1 { z-index: 0; transform: translate3d(var(--layer-1-x), var(--layer-1-y), 0) scale(1.04); }
    .sun { z-index: 1; transform: scale(1.02); }
    .fon2 { z-index: 2; transform: translate3d(var(--layer-2-x), var(--layer-2-y), 0) scale(1.06); }
    .fon3 { z-index: 3; transform: translate3d(var(--layer-3-x), var(--layer-3-y), 0) scale(1.08); }
    .fon5 { z-index: 4; transform: translate3d(var(--layer-5-x), var(--layer-5-y), 0) scale(1.12); }
    .content {
      position: relative;
      z-index: 5;
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }
    .card {
      width: min(100%, 480px);
      padding: 32px 28px;
      text-align: center;
      background: rgba(255, 255, 255, 0.74);
      border: 1px solid rgba(255, 255, 255, 0.58);
      border-radius: 20px;
      box-shadow: 0 24px 80px rgba(64, 92, 122, 0.28);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.75rem;
      font-weight: 700;
    }
    p {
      margin: 0 0 20px;
      color: #64748b;
      line-height: 1.5;
    }
    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto;
      border: 3px solid rgba(37, 99, 235, 0.2);
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .layer { transition: none; }
      .spinner { animation: none; border-top-color: #2563eb; }
    }
  </style>
</head>
<body>
  <main class="page" id="page">
    <img class="layer fon1" src="__FON1__" alt="" aria-hidden="true" />
    <img class="sun" src="__SUN__" alt="" aria-hidden="true" />
    <img class="layer fon2" src="__FON2__" alt="" aria-hidden="true" />
    <img class="layer fon3" src="__FON3__" alt="" aria-hidden="true" />
    <img class="layer fon5" src="__FON5__" alt="" aria-hidden="true" />
    <div class="content">
      <div class="card">
        <h1>Приложение обновляется</h1>
        <p>Подождите немного — после завершения деплоя страница обновится автоматически.</p>
        <div class="spinner" role="status" aria-label="Загрузка"></div>
      </div>
    </div>
  </main>
  <script>
    (function () {
      var marker = __MARKER_JSON__;
      var page = document.getElementById("page");
      if (page) {
        page.addEventListener("mousemove", function (event) {
          var rect = page.getBoundingClientRect();
          var x = (event.clientX - rect.left) / rect.width - 0.5;
          var y = (event.clientY - rect.top) / rect.height - 0.5;
          page.style.setProperty("--layer-1-x", (x * -13) + "px");
          page.style.setProperty("--layer-1-y", (y * -5) + "px");
          page.style.setProperty("--layer-2-x", (x * -30) + "px");
          page.style.setProperty("--layer-2-y", (y * -10) + "px");
          page.style.setProperty("--layer-3-x", (x * -50) + "px");
          page.style.setProperty("--layer-3-y", (y * -16) + "px");
          page.style.setProperty("--layer-5-x", (x * -84) + "px");
          page.style.setProperty("--layer-5-y", (y * -24) + "px");
        });
        page.addEventListener("mouseleave", function () {
          ["--layer-1-x","--layer-1-y","--layer-2-x","--layer-2-y","--layer-3-x","--layer-3-y","--layer-5-x","--layer-5-y"]
            .forEach(function (name) { page.style.setProperty(name, "0px"); });
        });
      }
      setInterval(function () {
        fetch(window.location.pathname + window.location.search, { cache: "no-store", credentials: "same-origin" })
          .then(function (response) { return response.text(); })
          .then(function (html) {
            if (html.indexOf(marker) === -1) window.location.reload();
          })
          .catch(function () {});
      }, 5000);
    })();
  </script>
</body>
</html>
""";

    public static string Render(IWebHostEnvironment env) =>
        Render(AppOfflineSpritePaths.Resolve(env));

    public static string Render(string spritesDirectory)
    {
        return HtmlTemplate
            .Replace("__MARKER__", Marker, StringComparison.Ordinal)
            .Replace("__MARKER_JSON__", JsonSerializer.Serialize(Marker), StringComparison.Ordinal)
            .Replace("__FON1__", ToDataUri(Path.Combine(spritesDirectory, "fon1.svg")), StringComparison.Ordinal)
            .Replace("__FON2__", ToDataUri(Path.Combine(spritesDirectory, "fon2.svg")), StringComparison.Ordinal)
            .Replace("__FON3__", ToDataUri(Path.Combine(spritesDirectory, "fon3.svg")), StringComparison.Ordinal)
            .Replace("__FON5__", ToDataUri(Path.Combine(spritesDirectory, "fon5.svg")), StringComparison.Ordinal)
            .Replace("__SUN__", ToDataUri(Path.Combine(spritesDirectory, "sun.svg")), StringComparison.Ordinal);
    }

    private static string ToDataUri(string path)
    {
        var bytes = File.ReadAllBytes(path);
        return $"data:image/svg+xml;base64,{Convert.ToBase64String(bytes)}";
    }
}
