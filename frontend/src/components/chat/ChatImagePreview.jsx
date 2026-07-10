import { useState } from 'react';
import {
  alpha,
  Box,
  Dialog,
  IconButton,
  Typography
} from '@mui/material';
import { Close } from '@mui/icons-material';

export default function ChatImagePreview({
  src,
  alt = 'Изображение',
  previewSx,
  maxPreviewHeight = 280,
  maxPreviewWidth = 320
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Открыть изображение: ${alt}`}
        sx={{
          display: 'block',
          p: 0,
          m: 0,
          border: 'none',
          background: 'none',
          cursor: 'zoom-in',
          borderRadius: 2,
          overflow: 'hidden',
          maxWidth: maxPreviewWidth,
          lineHeight: 0,
          ...previewSx
        }}
      >
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: maxPreviewHeight,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 2,
            border: (t) => `1px solid ${alpha(t.palette.divider, 0.9)}`,
            bgcolor: (t) => alpha(t.palette.grey[100], 0.6)
          }}
        />
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth={false}
        slotProps={{
          paper: {
            sx: {
              m: 2,
              maxWidth: 'min(96vw, 1400px)',
              maxHeight: '96vh',
              bgcolor: 'transparent',
              boxShadow: 'none',
              overflow: 'visible'
            }
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
            sx={{
              position: 'absolute',
              top: -12,
              right: -12,
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' }
            }}
          >
            <Close />
          </IconButton>
          <Box
            component="img"
            src={src}
            alt={alt}
            sx={{
              display: 'block',
              maxWidth: 'min(96vw, 1400px)',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 2,
              boxShadow: (t) => `0 16px 48px ${alpha(t.palette.common.black, 0.35)}`
            }}
          />
          {alt ? (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 1,
                textAlign: 'center',
                color: 'common.white',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)'
              }}
            >
              {alt}
            </Typography>
          ) : null}
        </Box>
      </Dialog>
    </>
  );
}
