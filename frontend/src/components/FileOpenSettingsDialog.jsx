import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { fetchFileOpenSettings, saveFileOpenSettings } from '../services/fileOpenSettingsApi';
import {
  DEFAULT_FILE_OPEN_SETTINGS,
  setFileOpenSettingsCache
} from '../utils/fileOpenSettingsCache';
import { useUiFeedback } from '../context/UiFeedbackContext';

export default function FileOpenSettingsDialog({ open, onClose }) {
  const { showSuccess, showError } = useUiFeedback();
  const [windowsHost, setWindowsHost] = useState(DEFAULT_FILE_OPEN_SETTINGS.windowsHost);
  const [shareName, setShareName] = useState(DEFAULT_FILE_OPEN_SETTINGS.shareName);
  const [macSmbHost, setMacSmbHost] = useState(DEFAULT_FILE_OPEN_SETTINGS.macSmbHost);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);
    fetchFileOpenSettings()
      .then((data) => {
        if (cancelled) return;
        setWindowsHost(data.windowsHost || DEFAULT_FILE_OPEN_SETTINGS.windowsHost);
        setShareName(data.shareName || DEFAULT_FILE_OPEN_SETTINGS.shareName);
        setMacSmbHost(data.macSmbHost || DEFAULT_FILE_OPEN_SETTINGS.macSmbHost);
      })
      .catch((err) => {
        if (!cancelled) showError(err?.message || 'Не удалось загрузить настройки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, showError]);

  const handleSave = async () => {
    const payload = {
      windowsHost: windowsHost.trim(),
      shareName: shareName.trim(),
      macSmbHost: macSmbHost.trim()
    };

    if (!payload.windowsHost || !payload.shareName || !payload.macSmbHost) {
      showError('Заполните все поля');
      return;
    }

    setSaving(true);
    try {
      await saveFileOpenSettings(payload);
      setFileOpenSettingsCache(payload);
      showSuccess('Настройки файлового сервера сохранены');
      onClose?.();
    } catch (err) {
      showError(err?.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const previewUnc = `\\\\${windowsHost.trim() || '…'}\\${shareName.trim() || '…'}\\…`;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Файловый сервер</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Корень для открытия макетов по сети. На Windows это UNC-путь вида{' '}
          <code>{previewUnc}</code>
        </Typography>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Имя Windows-сервера (ПК в сети)"
            value={windowsHost}
            onChange={(e) => setWindowsHost(e.target.value)}
            disabled={loading || saving}
            fullWidth
            autoFocus
            helperText="Например MINIMARKER — не IP, а имя компьютера в локальной сети"
          />
          <TextField
            label="Имя шары (корень файлов)"
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            disabled={loading || saving}
            fullWidth
            helperText="SMB-шара на этом ПК, например Клиенты"
          />
          <TextField
            label="Хост для Mac (SMB)"
            value={macSmbHost}
            onChange={(e) => setMacSmbHost(e.target.value)}
            disabled={loading || saving}
            fullWidth
            helperText="Обычно то же имя в нижнем регистре, например minimarker"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
