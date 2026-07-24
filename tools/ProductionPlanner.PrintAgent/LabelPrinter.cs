using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Drawing.Text;
using QRCoder;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Термоэтикетка 75×120 мм (X×Y):
/// слева 30×120 — «Задача», текст вдоль оси Y (поворот 90°);
/// справа две ячейки 40×60 — QR и номер заказа.
/// </summary>
internal static class LabelPrinter
{
    private const float LabelWidthMm = 75f;
    private const float LabelHeightMm = 120f;
    private const float LeftColMm = 30f;
    private const float RightColMm = 40f;
    private const float RightCellMm = 60f;

    public static void Print(
        string printerName,
        string customerName,
        string fileName,
        string pickupCode,
        string? orderUrl = null)
    {
        if (string.IsNullOrWhiteSpace(printerName))
            throw new InvalidOperationException("Не выбран принтер");

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
            var leftCol = Mm(LeftColMm);
            var rightCol = Mm(RightColMm);
            var rightCell = Mm(RightCellMm);
            var contentW = leftCol + rightCol;
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

            var taskTitle = (customerName ?? "").Trim();
            if (string.IsNullOrEmpty(taskTitle))
                taskTitle = (fileName ?? "").Trim();
            if (string.IsNullOrEmpty(taskTitle))
                taskTitle = "ЗАКАЗ";

            var code = (pickupCode ?? "").Trim();
            if (string.IsNullOrEmpty(code))
                code = "—";

            var left = originX;
            var top = originY;
            var rightColLeft = left + leftCol;

            using var outerPen = new Pen(Color.Black, 2f);
            using var innerPen = new Pen(Color.Black, 1.5f);

            g.DrawRectangle(outerPen, left, top, contentW, pageH);
            g.DrawLine(innerPen, rightColLeft, top, rightColLeft, top + pageH);
            g.DrawLine(innerPen, rightColLeft, top + rightCell, left + contentW, top + rightCell);

            DrawRotatedTaskTitle(g, taskTitle, left, top, leftCol, pageH);
            DrawQrCell(g, orderUrl, rightColLeft, top, rightCol, rightCell);
            DrawOrderNumberCell(g, code, rightColLeft, top + rightCell, rightCol, rightCell);

            e.HasMorePages = false;
        };

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

    private static void DrawRotatedTaskTitle(
        Graphics g,
        string text,
        float x,
        float y,
        float width,
        float height)
    {
        // Текст вдоль Y: после поворота +90° читается сверху вниз по длинной стороне.
        var state = g.Save();
        try
        {
            g.TranslateTransform(x + width, y);
            g.RotateTransform(90f);

            var pad = Mm(2f);
            var rect = new RectangleF(pad, pad, height - pad * 2f, width - pad * 2f);
            var fontSize = FitFontSize(g, text, rect.Width, rect.Height, 28f, 9f);
            using var font = new Font("Arial", fontSize, FontStyle.Bold);
            using var format = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center,
                Trimming = StringTrimming.EllipsisCharacter
            };
            g.DrawString(text.ToUpperInvariant(), font, Brushes.Black, rect, format);
        }
        finally
        {
            g.Restore(state);
        }
    }

    private static void DrawQrCell(
        Graphics g,
        string? orderUrl,
        float x,
        float y,
        float width,
        float height)
    {
        var pad = Mm(2.5f);
        var maxSide = Math.Min(width, height) - pad * 2f;
        if (maxSide < Mm(8f))
            return;

        var sizePx = Math.Max(128, (int)Math.Round(maxSide));
        using var qrImage = TryCreateQrImage(orderUrl, sizePx);
        if (qrImage == null)
        {
            using var hintFont = new Font("Arial", 8f, FontStyle.Regular);
            g.DrawString(
                "нет QR",
                hintFont,
                Brushes.Gray,
                new RectangleF(x, y, width, height),
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                });
            return;
        }

        var qrX = x + (width - maxSide) / 2f;
        var qrY = y + (height - maxSide) / 2f;
        g.DrawImage(qrImage, qrX, qrY, maxSide, maxSide);
    }

    private static void DrawOrderNumberCell(
        Graphics g,
        string code,
        float x,
        float y,
        float width,
        float height)
    {
        var pad = Mm(2f);
        var hintH = Mm(8f);
        var hintRect = new RectangleF(x + pad, y + Mm(3f), width - pad * 2f, hintH);
        using (var hintFont = new Font("Arial", 7f, FontStyle.Regular))
        {
            g.DrawString(
                "заказ",
                hintFont,
                Brushes.Gray,
                hintRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                });
        }

        var codeRect = new RectangleF(
            x + pad,
            y + hintH + Mm(2f),
            width - pad * 2f,
            height - hintH - Mm(6f));
        var fontSize = FitFontSize(g, code, codeRect.Width, codeRect.Height, 36f, 12f);
        using var codeFont = new Font("Arial", fontSize, FontStyle.Bold);
        g.DrawString(
            code,
            codeFont,
            Brushes.Black,
            codeRect,
            new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center,
                Trimming = StringTrimming.EllipsisCharacter,
                FormatFlags = StringFormatFlags.NoWrap
            });
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

    private static Bitmap? TryCreateQrImage(string? orderUrl, int sizePx)
    {
        var url = (orderUrl ?? "").Trim();
        if (string.IsNullOrEmpty(url) || sizePx < 16)
            return null;

        try
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
            var qr = new QRCode(data);
            using var raw = qr.GetGraphic(4, Color.Black, Color.White, drawQuietZones: true);
            var bmp = new Bitmap(sizePx, sizePx);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                g.InterpolationMode = InterpolationMode.NearestNeighbor;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                g.DrawImage(raw, 0, 0, sizePx, sizePx);
            }

            return bmp;
        }
        catch
        {
            return null;
        }
    }

    private static float Mm(float mm) => mm / 25.4f * 100f;

    private static int MmToHundredthsInch(float mm) =>
        (int)Math.Round(Mm(mm));
}
