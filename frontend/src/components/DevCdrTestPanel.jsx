import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { Image, OpenInNew } from '@mui/icons-material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { extractCdrPreview } from '../utils/cdrPreview';
import { DEV_TEST_CDR_PATH, isFileOpenerAgentRunning, openDevFileViaAgent } from '../utils/fileOpenerAgent';

export default function DevCdrTestPanel() {
  const { showSuccess, showError } = useUiFeedback();
  const [agentOk, setAgentOk] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewInfo, setPreviewInfo] = useState('');
  const [opening, setOpening] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    isFileOpenerAgentRunning().then(setAgentOk);
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
      showError(result.text || `Ошибка ${result.status}`);
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
        DEV: тест C:\0.cdr (удалить потом)
      </Typography>

      {agentOk === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Агент не отвечает на 127.0.0.1:17888 — запустите install.bat и проверьте health.
        </Alert>
      )}
      {agentOk === true && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Агент работает (health ok).
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<OpenInNew />}
          onClick={handleOpen}
          disabled={opening}
        >
          Открыть C:\0.cdr
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
        «Открыть» — через агент /open-dev. «Превью» — выберите .cdr в диалоге (например C:\0.cdr).
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
