using System;
using System.Drawing;
using System.Drawing.Printing;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Этикетка на всю ширину A4: слева заказчик (~2 см) + имя файла, справа код получения.
/// </summary>
internal static class LabelPrinter
{
    public static void Print(
        string printerName,
        string customerName,
        string fileName,
        string pickupCode)
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

            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            var left = e.MarginBounds.Left;
            var top = e.MarginBounds.Top;
            var fullWidth = e.MarginBounds.Width;
            // Заголовок ~2 см + файл ~7 мм + поля ≈ 3.3 см
            const float labelHeight = 130f;
            const float codeCellWidth = 160f;
            var textWidth = fullWidth - codeCellWidth;
            if (textWidth < 200)
                textWidth = fullWidth * 0.72f;

            var header = (customerName ?? "").Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(header))
                header = "ЗАКАЗ";

            var file = (fileName ?? "").Trim();
            var code = (pickupCode ?? "").Trim();
            if (string.IsNullOrEmpty(code))
                code = "—";

            using var outerPen = new Pen(Color.Black, 2.2f);
            using var innerPen = new Pen(Color.Black, 1.5f);
            // ~2 см высоты заглавных: ≈ 56–58 pt Arial Bold
            using var headerFont = new Font("Arial", 56, FontStyle.Bold);
            // ~7 мм высоты строки файла ≈ 28 pt
            using var fileFont = new Font("Arial", 28, FontStyle.Regular);
            using var codeFont = new Font("Arial", 36, FontStyle.Bold);
            using var codeHintFont = new Font("Arial", 7, FontStyle.Regular);

            g.DrawRectangle(outerPen, left, top, fullWidth, labelHeight);

            var codeLeft = left + textWidth;
            g.DrawLine(innerPen, codeLeft, top, codeLeft, top + labelHeight);

            var textPad = 12f;
            // Полоса заголовка ~2 см (78 hundredths)
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
                // ~7 мм (≈ 28 hundredths)
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

            var codeRect = new RectangleF(codeLeft, top + 22f, codeCellWidth, labelHeight - 40f);
            g.DrawString(code, codeFont, Brushes.Black, codeRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center,
                    Trimming = StringTrimming.EllipsisCharacter,
                    FormatFlags = StringFormatFlags.NoWrap
                });

            var hintRect = new RectangleF(codeLeft, top + 6f, codeCellWidth, 16f);
            g.DrawString("получение", codeHintFont, Brushes.Gray, hintRect,
                new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                });

            var tearY = top + labelHeight + 14f;
            using var dash = new Pen(Color.Gray, 1f)
            {
                DashStyle = System.Drawing.Drawing2D.DashStyle.Dash
            };
            g.DrawLine(dash, left, tearY, left + fullWidth, tearY);
            using var tearFont = new Font("Arial", 7, FontStyle.Italic);
            g.DrawString("отрыв", tearFont, Brushes.Gray, left + fullWidth - 36f, tearY + 2f);

            e.HasMorePages = false;
        };

        doc.Print();
    }
}
