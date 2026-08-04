using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Drawing.Text;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Термоэтикетка 75×120 мм (X×Y), бумага выходит вдоль длинной стороны:
/// слева 30×120 — название компании вдоль оси 120 мм;
/// справа 30×120 — номер заказа вдоль оси 120 мм (параллельно названию).
/// </summary>
internal static class LabelPrinter
{
    private const float LabelWidthMm = 75f;
    private const float LabelHeightMm = 120f;
    private const float ColWidthMm = 30f;

    public static void Print(
        string printerName,
        string customerName,
        string pickupCode,
        int copies = 1)
    {
        if (string.IsNullOrWhiteSpace(printerName))
            throw new InvalidOperationException("Не выбран принтер");

        var copyCount = copies < 1 ? 1 : (copies > 50 ? 50 : copies);

        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = printerName;
        if (!doc.PrinterSettings.IsValid)
            throw new InvalidOperationException("Принтер недоступен: " + printerName);

        doc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
        doc.OriginAtMargins = false;
        ApplyLabelPaper(doc);

        doc.PrintPage += (_, e) =>
        {
            var g = e.Graphics;
            if (g == null)
                return;

            // Рисуем в сотых дюйма — надёжнее для термодрайверов, чем PageUnit=mm.
            g.PageUnit = GraphicsUnit.Display;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.InterpolationMode = InterpolationMode.NearestNeighbor;
            g.PixelOffsetMode = PixelOffsetMode.Half;

            var pageW = Mm(LabelWidthMm);
            var pageH = Mm(LabelHeightMm);
            var colW = Mm(ColWidthMm);
            var contentW = colW * 2f;
            var originX = (pageW - contentW) / 2f;
            var originY = 0f;

            // Если драйвер подставил другой PaperSize — вписываем в доступную область.
            var bounds = e.PageBounds;
            if (bounds.Width > 0 && bounds.Height > 0)
            {
                var scale = Math.Min(bounds.Width / pageW, bounds.Height / pageH);
                if (scale > 0f && scale < 0.999f)
                {
                    g.TranslateTransform(
                        (bounds.Width - pageW * scale) / 2f,
                        (bounds.Height - pageH * scale) / 2f);
                    g.ScaleTransform(scale, scale);
                }
            }

            var company = (customerName ?? "").Trim();
            if (string.IsNullOrEmpty(company))
                company = "ЗАКАЗЧИК";

            var code = (pickupCode ?? "").Trim();
            if (string.IsNullOrEmpty(code))
                code = "—";

            var left = originX;
            var top = originY;
            var rightColLeft = left + colW;

            using var outerPen = new Pen(Color.Black, 2f);
            using var innerPen = new Pen(Color.Black, 1.5f);

            g.DrawRectangle(outerPen, left, top, contentW, pageH);
            g.DrawLine(innerPen, rightColLeft, top, rightColLeft, top + pageH);

            // Длинное название — до 2 строк; номер заказа — одна строка.
            DrawAlongLongAxis(g, company, left, top, colW, pageH, maxLines: 2);
            DrawAlongLongAxis(g, code, rightColLeft, top, colW, pageH, maxLines: 1);

            e.HasMorePages = false;
        };

        // Цикл: драйверы термопринтеров часто игнорируют PrinterSettings.Copies.
        for (var i = 0; i < copyCount; i++)
            doc.Print();
    }

    private static void ApplyLabelPaper(PrintDocument doc)
    {
        var targetW = MmToHundredthsInch(LabelWidthMm);
        var targetH = MmToHundredthsInch(LabelHeightMm);

        PaperSize? best = null;
        var bestScore = int.MaxValue;
        foreach (PaperSize size in doc.PrinterSettings.PaperSizes)
        {
            var score = Math.Abs(size.Width - targetW) + Math.Abs(size.Height - targetH);
            var scoreRotated = Math.Abs(size.Width - targetH) + Math.Abs(size.Height - targetW);
            var local = Math.Min(score, scoreRotated);
            if (local < bestScore)
            {
                bestScore = local;
                best = size;
            }
        }

        // Допуск ~3 мм: берём размер из драйвера, иначе задаём свой.
        if (best != null && bestScore <= MmToHundredthsInch(3f) * 2)
        {
            doc.DefaultPageSettings.PaperSize = best;
            // Если драйвер отдал 120×75, а нам нужно 75×120 — включаем landscape.
            if (Math.Abs(best.Width - targetH) + Math.Abs(best.Height - targetW)
                < Math.Abs(best.Width - targetW) + Math.Abs(best.Height - targetH))
            {
                doc.DefaultPageSettings.Landscape = true;
            }
        }
        else
        {
            doc.DefaultPageSettings.PaperSize = new PaperSize("Label75x120", targetW, targetH);
        }
    }

    /// <summary>
    /// Текст вдоль оси Y (120 мм), повёрнутый на 90°.
    /// При maxLines=2 длинное название делится на две строки.
    /// </summary>
    private static void DrawAlongLongAxis(
        Graphics g,
        string text,
        float x,
        float y,
        float width,
        float height,
        int maxLines)
    {
        var state = g.Save();
        try
        {
            g.TranslateTransform(x + width, y);
            g.RotateTransform(90f);

            var pad = Mm(2f);
            // После поворота: длина строки = 120 мм, высота блока = ширина колонки 30 мм.
            var rect = new RectangleF(pad, pad, height - pad * 2f, width - pad * 2f);
            var display = text.ToUpperInvariant();

            string drawText;
            float fontSize;
            if (maxLines >= 2 && !FitsSingleLine(g, display, rect.Width, rect.Height, minPt: 10f))
            {
                var (line1, line2) = SplitIntoTwoLines(display);
                drawText = line1 + "\n" + line2;
                fontSize = FitTwoLineFontSize(g, line1, line2, rect.Width, rect.Height, 28f, 8f);
            }
            else
            {
                drawText = display;
                fontSize = FitFontSize(g, display, rect.Width, rect.Height, 32f, 9f);
            }

            using var font = new Font("Arial", fontSize, FontStyle.Bold);
            if (drawText.IndexOf('\n') >= 0)
            {
                DrawTwoCenteredLines(g, drawText, font, rect);
            }
            else
            {
                using var format = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter,
                    FormatFlags = StringFormatFlags.NoWrap
                };
                g.DrawString(drawText, font, Brushes.Black, rect, format);
            }
        }
        finally
        {
            g.Restore(state);
        }
    }

    private static void DrawTwoCenteredLines(
        Graphics g,
        string drawText,
        Font font,
        RectangleF rect)
    {
        var parts = drawText.Split(new[] { '\n' }, 2);
        var line1 = parts[0];
        var line2 = parts.Length > 1 ? parts[1] : "";

        var h1 = g.MeasureString(line1, font).Height;
        var h2 = string.IsNullOrEmpty(line2) ? 0f : g.MeasureString(line2, font).Height;
        var totalH = h1 + h2;
        var top = rect.Y + (rect.Height - totalH) / 2f;

        using var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center,
            Trimming = StringTrimming.EllipsisCharacter,
            FormatFlags = StringFormatFlags.NoWrap
        };

        g.DrawString(line1, font, Brushes.Black, new RectangleF(rect.X, top, rect.Width, h1), format);
        if (!string.IsNullOrEmpty(line2))
        {
            g.DrawString(
                line2,
                font,
                Brushes.Black,
                new RectangleF(rect.X, top + h1, rect.Width, h2),
                format);
        }
    }

    private static bool FitsSingleLine(
        Graphics g,
        string text,
        float maxWidth,
        float maxHeight,
        float minPt)
    {
        using var font = new Font("Arial", minPt, FontStyle.Bold);
        var measured = g.MeasureString(text, font);
        return measured.Width <= maxWidth && measured.Height <= maxHeight;
    }

    /// <summary>
    /// Делит название примерно пополам: по пробелу/дефису у середины, иначе по символам.
    /// </summary>
    private static (string Line1, string Line2) SplitIntoTwoLines(string text)
    {
        var t = (text ?? "").Trim();
        if (t.Length <= 1)
            return (t, "");

        var mid = t.Length / 2;
        var best = -1;
        var bestDist = int.MaxValue;
        for (var i = 1; i < t.Length; i++)
        {
            var ch = t[i - 1];
            if (ch != ' ' && ch != '-' && ch != '–' && ch != '—')
                continue;
            var dist = Math.Abs(i - mid);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = i;
            }
        }

        if (best > 0)
        {
            var left = t.Substring(0, best).TrimEnd(' ', '-', '–', '—');
            var right = t.Substring(best).TrimStart(' ', '-', '–', '—');
            if (left.Length > 0 && right.Length > 0)
                return (left, right);
        }

        return (t.Substring(0, mid).Trim(), t.Substring(mid).Trim());
    }

    private static float FitFontSize(
        Graphics g,
        string text,
        float maxWidth,
        float maxHeight,
        float maxPt,
        float minPt)
    {
        for (var size = maxPt; size >= minPt; size -= 1f)
        {
            using var font = new Font("Arial", size, FontStyle.Bold);
            var measured = g.MeasureString(text, font);
            if (measured.Width <= maxWidth && measured.Height <= maxHeight)
                return size;
        }

        return minPt;
    }

    private static float FitTwoLineFontSize(
        Graphics g,
        string line1,
        string line2,
        float maxWidth,
        float maxHeight,
        float maxPt,
        float minPt)
    {
        for (var size = maxPt; size >= minPt; size -= 1f)
        {
            using var font = new Font("Arial", size, FontStyle.Bold);
            var m1 = g.MeasureString(line1, font);
            var m2 = g.MeasureString(line2, font);
            var totalW = Math.Max(m1.Width, m2.Width);
            var totalH = m1.Height + m2.Height;
            if (totalW <= maxWidth && totalH <= maxHeight)
                return size;
        }

        return minPt;
    }

    private static float Mm(float mm) => mm / 25.4f * 100f;

    private static int MmToHundredthsInch(float mm) =>
        (int)Math.Round(Mm(mm));
}
