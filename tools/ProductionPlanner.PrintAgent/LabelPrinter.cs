using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Drawing.Text;
using QRCoder;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Этикетка на всю ширину A4: слева заказчик + имя файла, справа код получения и QR на страницу заказа.
/// </summary>
internal static class LabelPrinter
{
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

        doc.DefaultPageSettings.Landscape = false;
        doc.DefaultPageSettings.Margins = new Margins(28, 28, 28, 28);

        doc.PrintPage += (_, e) =>
        {
            var g = e.Graphics;
            if (g == null)
                return;

            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var left = e.MarginBounds.Left;
            var top = e.MarginBounds.Top;
            var fullWidth = e.MarginBounds.Width;
            // Заголовок ~2 см + файл ~7 мм + поля ≈ 3.3 см
            const float labelHeight = 130f;
            const float codeCellWidth = 130f;
            const float qrCellWidth = 118f;
            var textWidth = fullWidth - codeCellWidth - qrCellWidth;
            if (textWidth < 180)
                textWidth = fullWidth * 0.55f;

            var header = (customerName ?? "").Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(header))
                header = "ЗАКАЗ";

            var file = (fileName ?? "").Trim();
            var code = (pickupCode ?? "").Trim();
            if (string.IsNullOrEmpty(code))
                code = "—";

            using var outerPen = new Pen(Color.Black, 2.2f);
            using var innerPen = new Pen(Color.Black, 1.5f);
            using var headerFont = new Font("Arial", 56, FontStyle.Bold);
            using var fileFont = new Font("Arial", 28, FontStyle.Regular);
            using var codeFont = new Font("Arial", 32, FontStyle.Bold);
            using var codeHintFont = new Font("Arial", 7, FontStyle.Regular);

            g.DrawRectangle(outerPen, left, top, fullWidth, labelHeight);

            var codeLeft = left + textWidth;
            var qrLeft = codeLeft + codeCellWidth;
            g.DrawLine(innerPen, codeLeft, top, codeLeft, top + labelHeight);
            g.DrawLine(innerPen, qrLeft, top, qrLeft, top + labelHeight);

            var textPad = 12f;
            var headerRect = new RectangleF(
                left + textPad,
                top + 4f,
                textWidth - textPad * 2,
                78f);
            g.DrawString(header, headerFont, Brushes.Black, headerRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Near,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter,
                    FormatFlags = StringFormatFlags.NoWrap
                });

            if (!string.IsNullOrEmpty(file))
            {
                var fileRect = new RectangleF(
                    left + textPad,
                    top + 86f,
                    textWidth - textPad * 2,
                    36f);
                g.DrawString(file, fileFont, Brushes.Black, fileRect,
                    new StringFormat
                    {
                        Alignment = StringAlignment.Near,
                        LineAlignment = StringAlignment.Center,
                        Trimming = StringTrimming.EllipsisCharacter,
                        FormatFlags = StringFormatFlags.NoWrap
                    });
            }

            var hintRect = new RectangleF(codeLeft, top + 6f, codeCellWidth, 16f);
            g.DrawString("получение", codeHintFont, Brushes.Gray, hintRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                });

            var codeRect = new RectangleF(codeLeft, top + 22f, codeCellWidth, labelHeight - 40f);
            g.DrawString(code, codeFont, Brushes.Black, codeRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter,
                    FormatFlags = StringFormatFlags.NoWrap
                });

            using (var qrImage = TryCreateQrImage(orderUrl, 96))
            {
                if (qrImage != null)
                {
                    var qrX = qrLeft + (qrCellWidth - qrImage.Width) / 2f;
                    var qrY = top + (labelHeight - qrImage.Height) / 2f;
                    g.DrawImage(qrImage, qrX, qrY, qrImage.Width, qrImage.Height);
                }
            }

            var tearY = top + labelHeight + 14f;
            using var dash = new Pen(Color.Gray, 1f)
            {
                DashStyle = DashStyle.Dash
            };
            g.DrawLine(dash, left, tearY, left + fullWidth, tearY);
            using var tearFont = new Font("Arial", 7, FontStyle.Italic);
            g.DrawString("отрыв", tearFont, Brushes.Gray, left + fullWidth - 36f, tearY + 2f);

            e.HasMorePages = false;
        };

        doc.Print();
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
}
