using System;
using System.Drawing;
using System.Drawing.Printing;

namespace ProductionPlanner.PrintAgent;

/// <summary>
/// Печать полосы ~150×20 мм вверху листа A4 (остальное пустое — отрыв снизу).
/// </summary>
internal static class LabelPrinter
{
    public static void Print(string printerName, string orderTitle, string pickupCode)
    {
        if (string.IsNullOrWhiteSpace(printerName))
            throw new InvalidOperationException("Не выбран принтер");

        using var doc = new PrintDocument();
        doc.PrinterSettings.PrinterName = printerName;
        if (!doc.PrinterSettings.IsValid)
            throw new InvalidOperationException("Принтер недоступен: " + printerName);

        doc.DefaultPageSettings.Landscape = false;
        doc.DefaultPageSettings.Margins = new Margins(20, 20, 20, 20);

        doc.PrintPage += (_, e) =>
        {
            var g = e.Graphics;
            if (g == null)
                return;

            // 1 inch = 100 hundredths; 15cm ≈ 5.9", 2cm ≈ 0.79"
            const float labelWidth = 590f;
            const float labelHeight = 79f;
            var left = e.MarginBounds.Left;
            var top = e.MarginBounds.Top;

            using var titleFont = new Font("Arial", 11, FontStyle.Regular);
            using var codeFont = new Font("Arial", 22, FontStyle.Bold);
            using var pen = new Pen(Color.Black, 1);

            g.DrawRectangle(pen, left, top, labelWidth, labelHeight);

            var code = (pickupCode ?? "").Trim();
            var title = (orderTitle ?? "").Trim();
            if (title.Length > 80)
                title = title.Substring(0, 80) + "…";

            g.DrawString(code, codeFont, Brushes.Black, left + 8, top + 6);
            g.DrawString(title, titleFont, Brushes.Black, left + 8, top + 48);

            // Линия отрыва под этикеткой
            var tearY = top + labelHeight + 12;
            using var dash = new Pen(Color.Gray, 1) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dash };
            g.DrawLine(dash, left, tearY, left + labelWidth, tearY);
            using var hintFont = new Font("Arial", 7, FontStyle.Italic);
            g.DrawString("отрыв", hintFont, Brushes.Gray, left + labelWidth - 40, tearY + 2);

            e.HasMorePages = false;
        };

        doc.Print();
    }
}
