using System;
using System.Drawing;
using System.Drawing.Printing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ProductionPlanner.PrintAgent;

internal sealed class MainForm : Form
{
    private readonly AgentConfig _config;
    private readonly PrintAgentClient _client;
    private readonly ComboBox _printerCombo = new();
    private readonly TextBox _serverBox = new();
    private readonly TextBox _tokenBox = new();
    private readonly CheckBox _startupCheck = new();
    private readonly Label _statusLabel = new();
    private readonly NotifyIcon _tray = new();
    private readonly Button _connectButton = new();
    private CancellationTokenSource? _cts;
    private bool _allowClose;

    public MainForm(AgentConfig config)
    {
        _config = config;
        _client = new PrintAgentClient(config);
        _client.StatusChanged += msg => BeginInvoke(new Action(() => SetStatus(msg)));
        _client.JobPrinting += job => BeginInvoke(new Action(() =>
            SetStatus($"Печать: {job.PickupCode} — {job.OrderTitle}")));

        Text = "ProductionPlanner — печать этикеток";
        Width = 520;
        Height = 340;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        var serverLabel = new Label { Text = "Адрес сайта:", Left = 16, Top = 18, Width = 120 };
        _serverBox.Left = 140;
        _serverBox.Top = 14;
        _serverBox.Width = 340;
        _serverBox.Text = _config.ServerUrl;

        var tokenLabel = new Label { Text = "Токен агента:", Left = 16, Top = 54, Width = 120 };
        _tokenBox.Left = 140;
        _tokenBox.Top = 50;
        _tokenBox.Width = 340;
        _tokenBox.Text = _config.AccessToken;
        _tokenBox.UseSystemPasswordChar = true;

        var printerLabel = new Label { Text = "Принтер:", Left = 16, Top = 90, Width = 120 };
        _printerCombo.Left = 140;
        _printerCombo.Top = 86;
        _printerCombo.Width = 340;
        _printerCombo.DropDownStyle = ComboBoxStyle.DropDownList;

        _startupCheck.Left = 140;
        _startupCheck.Top = 126;
        _startupCheck.Width = 340;
        _startupCheck.Text = "Запускать с Windows";
        _startupCheck.Checked = _config.RunAtStartup;

        var saveButton = new Button { Text = "Сохранить", Left = 140, Top = 164, Width = 110 };
        saveButton.Click += (_, _) => SaveSettings();

        var testButton = new Button { Text = "Тест печати", Left = 260, Top = 164, Width = 110 };
        testButton.Click += (_, _) => TestPrint();

        _connectButton.Text = "Подключить";
        _connectButton.Left = 380;
        _connectButton.Top = 164;
        _connectButton.Width = 100;
        _connectButton.Click += async (_, _) => await ToggleConnectionAsync();

        _statusLabel.Left = 16;
        _statusLabel.Top = 214;
        _statusLabel.Width = 470;
        _statusLabel.Height = 60;
        _statusLabel.Text = "Готов к работе";

        Controls.Add(serverLabel);
        Controls.Add(_serverBox);
        Controls.Add(tokenLabel);
        Controls.Add(_tokenBox);
        Controls.Add(printerLabel);
        Controls.Add(_printerCombo);
        Controls.Add(_startupCheck);
        Controls.Add(saveButton);
        Controls.Add(testButton);
        Controls.Add(_connectButton);
        Controls.Add(_statusLabel);

        _tray.Icon = SystemIcons.Application;
        _tray.Text = "Print Agent";
        _tray.Visible = true;
        _tray.DoubleClick += (_, _) =>
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        };

        var trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("Открыть", null, (_, _) =>
        {
            Show();
            WindowState = FormWindowState.Normal;
        });
        trayMenu.Items.Add("Выход", null, (_, _) =>
        {
            _allowClose = true;
            Close();
        });
        _tray.ContextMenuStrip = trayMenu;

        Load += async (_, _) =>
        {
            ReloadPrinters();
            if (_config.RunAtStartup)
                AutostartHelper.TryEnable(Application.ExecutablePath);

            if (!string.IsNullOrWhiteSpace(_config.AccessToken)
                && !string.IsNullOrWhiteSpace(_config.PrinterName))
            {
                await StartAgentAsync();
            }
        };

        Resize += (_, _) =>
        {
            if (WindowState == FormWindowState.Minimized)
                Hide();
        };

        FormClosing += async (s, e) =>
        {
            if (!_allowClose)
            {
                e.Cancel = true;
                Hide();
                return;
            }

            await StopAgentAsync();
            _tray.Visible = false;
        };
    }

    private void ReloadPrinters()
    {
        _printerCombo.Items.Clear();
        foreach (string printer in PrinterSettings.InstalledPrinters)
            _printerCombo.Items.Add(printer);

        if (!string.IsNullOrWhiteSpace(_config.PrinterName)
            && _printerCombo.Items.Contains(_config.PrinterName))
        {
            _printerCombo.SelectedItem = _config.PrinterName;
        }
        else if (_printerCombo.Items.Count > 0)
        {
            _printerCombo.SelectedIndex = 0;
        }
    }

    private void SaveSettings()
    {
        _config.ServerUrl = _serverBox.Text.Trim().TrimEnd('/');
        _config.AccessToken = _tokenBox.Text.Trim();
        _config.PrinterName = _printerCombo.SelectedItem?.ToString() ?? "";
        _config.RunAtStartup = _startupCheck.Checked;
        _config.Save();

        if (_config.RunAtStartup)
        {
            if (!AutostartHelper.TryEnable(Application.ExecutablePath))
                MessageBox.Show(
                    "Не удалось добавить в автозагрузку. Добавьте ярлык вручную в папку Startup.",
                    "Автозагрузка",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
        }
        else
        {
            AutostartHelper.TryDisable();
        }

        SetStatus("Настройки сохранены");
    }

    private void TestPrint()
    {
        SaveSettings();
        if (string.IsNullOrWhiteSpace(_config.PrinterName))
        {
            MessageBox.Show("Выберите принтер.", "Тест", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            LabelPrinter.Print(_config.PrinterName, "Тестовая этикетка", "Т00");
            SetStatus("Тестовая этикетка отправлена на принтер");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Ошибка печати", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task ToggleConnectionAsync()
    {
        if (_cts != null)
        {
            await StopAgentAsync();
            return;
        }

        SaveSettings();
        await StartAgentAsync();
    }

    private async Task StartAgentAsync()
    {
        if (_cts != null)
            return;

        if (string.IsNullOrWhiteSpace(_config.PrinterName))
        {
            SetStatus("Выберите принтер и нажмите «Сохранить»");
            return;
        }

        _cts = new CancellationTokenSource();
        _connectButton.Text = "Отключить";
        SetStatus("Подключение…");

        try
        {
            await _client.StartAsync(_cts.Token);
            SetStatus("Подключено, ожидание заданий");
        }
        catch (Exception ex)
        {
            SetStatus("Ошибка: " + ex.Message);
            await StopAgentAsync();
        }
    }

    private async Task StopAgentAsync()
    {
        var cts = _cts;
        _cts = null;
        if (cts != null)
        {
            cts.Cancel();
            cts.Dispose();
        }

        await _client.StopAsync();
        _connectButton.Text = "Подключить";
        SetStatus("Отключено");
    }

    private void SetStatus(string message)
    {
        _statusLabel.Text = DateTime.Now.ToString("HH:mm:ss") + " — " + message;
        _tray.Text = "Print Agent: " + (message.Length > 40 ? message.Substring(0, 40) : message);
    }
}
