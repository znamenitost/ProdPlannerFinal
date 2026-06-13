using System.Drawing;
using System.Windows.Forms;

namespace CdrPreviewShell;

internal sealed class CdrPreviewControl : SharpShell.SharpPreviewHandler.PreviewHandlerControl
{
    private readonly PictureBox _pictureBox;
    private readonly Label _messageLabel;

    public CdrPreviewControl()
    {
        _pictureBox = new PictureBox
        {
            Dock = DockStyle.Fill,
            SizeMode = PictureBoxSizeMode.Zoom,
            BackColor = Color.White
        };

        _messageLabel = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.Gray,
            Font = new Font("Segoe UI", 10f),
            Text = "Превью не найдено в файле .cdr",
            Visible = false
        };

        Controls.Add(_pictureBox);
        Controls.Add(_messageLabel);
    }

    public void DoPreview(string? filePath)
    {
        _pictureBox.Image?.Dispose();
        _pictureBox.Image = null;
        _pictureBox.Visible = false;
        _messageLabel.Visible = true;

        if (string.IsNullOrWhiteSpace(filePath))
        {
            _messageLabel.Text = "Путь к файлу не указан";
            return;
        }

        try
        {
            var bitmap = CdrPreviewExtractor.ExtractBitmap(filePath!);
            if (bitmap == null)
            {
                _messageLabel.Text = "Встроенное превью не найдено";
                return;
            }

            _pictureBox.Image = bitmap;
            _pictureBox.Visible = true;
            _messageLabel.Visible = false;
        }
        catch
        {
            _messageLabel.Text = "Не удалось прочитать файл";
        }
    }
}
