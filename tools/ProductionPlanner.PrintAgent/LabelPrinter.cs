using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Drawing.Text;
using QRCoder;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Термоэтикетка 75×120 мм:
/// слева 30×120 — название из столбца «Задача» (текст вдоль длинной стороны);
/// справа две ячейки 40×60 — QR и номер заказа (код получения).
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

        // PaperSize — сотые дюйма.
        var paperW = MmToHundredthsInch(LabelWidthMm);
        var paperH = MmToHundredthsInch(LabelHeightMm);
        doc.DefaultPageSettings.PaperSize = new PaperSize("Label75x120", paperW, paperH);
        doc.DefaultPageSettings.Landscape = false;
        doc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);

        doc.PrintPage += (_, e) =>
        {
            var g = e.Graphics;
            if (g == null)
                return;

            g.PageUnit = GraphicsUnit.Millimeter;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.InterpolationMode = InterpolationMode.NearestNeighbor;
            g.PixelOffsetMode = PixelOffsetMode.Half;

            // 30+40=70 → центрируем контент в 75 мм.
            var contentW = LeftColMm + RightColMm;
            var originX = (LabelWidthMm - contentW) / 2f;
            var originY = 0f;

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
            var rightColLeft = left + LeftColMm;

            using var outerPen = new Pen(Color.Black, 0.35f);
            using var innerPen = new Pen(Color.Black, 0.25f);

            g.DrawRectangle(outerPen, left, top, contentW, LabelHeightMm);
            g.DrawLine(innerPen, rightColLeft, top, rightColLeft, top + LabelHeightMm);
            g.DrawLine(innerPen, rightColLeft, top + RightCellMm, left + contentW, top + RightCellMm);

            DrawRotatedTaskTitle(g, taskTitle, left, top, LeftColMm, LabelHeightMm);
            DrawQrCell(g, orderUrl, rightColLeft, top, RightColMm, RightCellMm);
            DrawOrderNumberCell(g, code, rightColLeft, top + RightCellMm, RightColMm, RightCellMm);

            e.HasMorePages = false;
        };

        doc.Print();
    }

    private static void DrawRotatedTaskTitle(
        Graphics g,
        string text,
        float x,
        float y,
        float widthMm,
        float heightMm)
    {
        // Текст вдоль длинной стороны (120 мм): читается снизу вверх.
        var state = g.Save();
        try
        {
            g.TranslateTransform(x + widthMm, y);
            g.RotateTransform(90f);

            // После поворота: ширина = 120 мм (бывшая высота), высота = 30 мм (бывшая ширина).
            var pad = 2f;
            var rect = new RectangleF(pad, pad, heightMm - pad * 2f, widthMm - pad * 2f);

            var fontSize = FitFontSize(g, text, rect.Width, rect.Height, 28f, 8f);
            using var font = new Font("Arial", fontSize, FontStyle.Bold, GraphicsUnit.Point);
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
        float widthMm,
        float heightMm)
    {
        var pad = 3f;
        var maxSide = Math.Min(widthMm, heightMm) - pad * 2f;
        if (maxSide < 8f)
            return;

        using var qrImage = TryCreateQrImage(orderUrl, MmToPixels(g, maxSide));
        if (qrImage == null)
        {
            using var hintFont = new Font("Arial", 8f, FontStyle.Regular, GraphicsUnit.Point);
            g.DrawString(
                "нет QR",
                hintFont,
                Brushes.Gray,
                new RectangleF(x, y, widthMm, heightMm),
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                });
            return;
        }

        var drawW = maxSide;
        var drawH = maxSide;
        var qrX = x + (widthMm - drawW) / 2f;
        var qrY = y + (heightMm - drawH) / 2f;
        g.DrawImage(qrImage, qrX, qrY, drawW, drawH);
    }

    private static void DrawOrderNumberCell(
        Graphics g,
        string code,
        float x,
        float y,
        float widthMm,
        float heightMm)
    {
        var pad = 2f;
        var hintH = 8f;
        var hintRect = new RectangleF(x + pad, y + 3f, widthMm - pad * 2f, hintH);
        using (var hintFont = new Font("Arial", 7f, FontStyle.Regular, GraphicsUnit.Point))
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
            y + hintH + 2f,
            widthMm - pad * 2f,
            heightMm - hintH - 6f);
        var fontSize = FitFontSize(g, code, codeRect.Width, codeRect.Height, 36f, 10f);
        using var codeFont = new Font("Arial", fontSize, FontStyle.Bold, GraphicsUnit.Point);
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
        float maxWidthMm,
        float maxHeightMm,
        float maxPt,
        float minPt)
    {
        for (var size = maxPt; size >= minPt; size -= 1f)
        {
            using var font = new Font("Arial", size, FontStyle.Bold, GraphicsUnit.Point);
            var measured = g.MeasureString(text, font);
            // MeasureString возвращает единицы PageUnit (мм).
            if (measured.Width <= maxWidthMm && measured.Height <= maxHeightMm)
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

    private static int MmToHundredthsInch(float mm) =>
        (int)Math.Round(mm / 25.4f * 100f);

    private static int MmToPixels(Graphics g, float mm)
    {
        // При PageUnit=Millimeter DpiX всё ещё в пикселях на дюйм.
        var px = (int)Math.Round(mm / 25.4f * g.DpiX);
        return Math.Max(px, 64);
    }
}
