import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { Image, OpenInNew } from '@mui/icons-material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { extractCdrPreview } from '../utils/cdrPreview';
import {
  DEV_TEST_CDR_PATH,
  FILE_OPENER_BASE,
  isFileOpenerAgentRunning,
  isFileOpenerDevOpenSupported,
  openDevFileViaAgent
} from '../utils/fileOpenerAgent';

export default function DevCdrTestPanel() {
  const { showSuccess, showError } = useUiFeedback();
  const [agentOk, setAgentOk] = useState(null);
  const [devOpenOk, setDevOpenOk] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewInfo, setPreviewInfo] = useState('');
  const [opening, setOpening] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    isFileOpenerAgentRunning().then((ok) => {
      setAgentOk(ok);
      if (ok) {
        isFileOpenerDevOpenSupported().then(setDevOpenOk);
      } else {
        setDevOpenOk(false);
      }
    });
  }, []);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const result = await openDevFileViaAgent(DEV_TEST_CDR_PATH);
      if (result.ok) {
        showSuccess(`Открыт ${DEV_TEST_CDR_PATH}`);
        return;
      }
      if (result.text === 'not found') {
        showError(
          `Агент старый: нет /open-dev. Скачайте новый ZIP из меню приложения и запустите install.bat. Путь: ${DEV_TEST_CDR_PATH}`
        );
        return;
      }
      showError(`${result.text || `Ошибка ${result.status}`} (путь: ${DEV_TEST_CDR_PATH})`);
    } catch {
      showError('Агент не отвечает. Запустите install.bat и проверьте health.');
    } finally {
      setOpening(false);
    }
  };

  const handlePreviewClick = () => {
    fileInputRef.current?.click();
  };

  const handlePreviewFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewInfo('');
    setPreviewPending(true);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await extractCdrPreview(bytes);
      if (!result.ok) {
        showError(result.error);
        return;
      }
      setPreviewUrl(result.url);
      setPreviewInfo(result.method);
      showSuccess('Превью готово');
    } catch (err) {
      showError(err?.message || 'Не удалось построить превью');
    } finally {
      setPreviewPending(false);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2.5,
        borderStyle: 'dashed',
        borderColor: 'warning.main'
      }}
    >
      <Typography variant="subtitle2" color="warning.main" gutterBottom>
        DEV: тест {DEV_TEST_CDR_PATH} (удалить потом)
      </Typography>

      {agentOk === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Агент не отвечает на 127.0.0.1:17888 — запустите install.bat и проверьте health.
        </Alert>
      )}
      {agentOk === true && devOpenOk === true && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Агент работает, /open-dev доступен.
        </Alert>
      )}
      {agentOk === true && devOpenOk === false && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Агент запущен, но это старая версия без /open-dev. Скачайте ZIP и переустановите через install.bat.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<OpenInNew />}
          onClick={handleOpen}
          disabled={opening}
        >
          Открыть {DEV_TEST_CDR_PATH}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Image />}
          onClick={handlePreviewClick}
          disabled={previewPending}
        >
          Превью .cdr
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block">
        «Открыть» — {FILE_OPENER_BASE}/open-dev?path=… (в URL двоеточие кодируется как %3A — это нормально, путь {DEV_TEST_CDR_PATH}).
        «Превью» — выберите .cdr в диалоге.
      </Typography>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".cdr"
        onChange={handlePreviewFile}
      />

      {previewUrl && (
        <Box sx={{ mt: 2 }}>
          {previewInfo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, whiteSpace: 'pre-wrap' }}>
              {previewInfo}
            </Typography>
          )}
          <Box
            component="img"
            src={previewUrl}
            alt="CDR preview"
            sx={{ maxWidth: '100%', maxHeight: 320, border: 1, borderColor: 'divider', borderRadius: 1 }}
          />
        </Box>
      )}
    </Paper>
  );
}
