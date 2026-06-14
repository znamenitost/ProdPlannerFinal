import { useCallback, useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import { Image } from '@mui/icons-material';
import CdrPreviewDialog from './CdrPreviewDialog';
import { DEV_CDR_PREVIEW_ENABLED } from '../utils/devCdrPreviewConfig';
import { buildDevTestCdrPreview, DEV_TEST_CDR_PATH } from '../utils/devCdrTestPreview';

export default function DevCdrTestPreviewButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewInfo, setPreviewInfo] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const handleClick = useCallback(async (event) => {
    setAnchor({ x: event.clientX, y: event.clientY });
    setOpen(true);
    setPending(true);
    setPreviewUrl('');
    setPreviewInfo('');
    setPreviewError('');

    try {
      const preview = await buildDevTestCdrPreview();
      setPreviewUrl(preview.url);
      setPreviewInfo(preview.method || '');
    } catch (err) {
      setPreviewError(err?.message || 'Не удалось построить превью');
    } finally {
      setPending(false);
    }
  }, []);

  if (!DEV_CDR_PREVIEW_ENABLED) return null;

  return (
    <>
      <Tooltip title={`Тест read-dev: локальный файл ${DEV_TEST_CDR_PATH}`}>
        <Button variant="outlined" size="small" color="secondary" startIcon={<Image />} onClick={handleClick}>
          Тест C:\0.cdr
        </Button>
      </Tooltip>
      <CdrPreviewDialog
        open={open}
        anchor={anchor}
        taskTitle="Тест превью (локальный диск)"
        previewUrl={previewUrl}
        previewInfo={previewInfo}
        previewPath={DEV_TEST_CDR_PATH}
        previewError={previewError}
        pending={pending}
      />
    </>
  );
}
