import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  RotateRight as RotateRightIcon,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
  AutoFixHigh as AutoFixHighIcon
} from '@mui/icons-material';
import {
  GALLERY_FRAME_SX,
  GALLERY_MAX_PX,
  PRODUCT_IMAGE_SX,
  PRODUCT_STAGE_SX,
  galleryContentSx
} from './galleryFrame';
import { removeCatalogLogoBackground } from '../api';

/**
 * budl.svg / bud.svg = 45 × 95.1022 mm, budm.svg = 41.0993 × 66.1002 mm.
 * Zone is horizontally centered; top offset from the print contour on the base.
 */
const BUDAPEST_ZONE = {
  left: `${((45 - 41.0993) / 2 / 45) * 100}%`,
  top: `${(15.026 / 95.1022) * 100}%`,
  width: `${(41.0993 / 45) * 100}%`,
  height: `${(66.1002 / 95.1022) * 100}%`
};

const maskLayerSx = (maskUrl) =>
  maskUrl
    ? {
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskMode: 'luminance',
        maskMode: 'luminance'
      }
    : {};

function isRasterDataUrl(dataUrl) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl || '');
}

export default function MockupPanel({ zone, baseImageUrl, transform, onChange }) {
  const [logoUrl, setLogoUrl] = useState(transform?.logoDataUrl || '');
  const [removingBg, setRemovingBg] = useState(false);
  const [bgError, setBgError] = useState('');

  const zoneBox = useMemo(() => {
    if (!zone?.maskUrl) return { left: 0, top: 0, width: '100%', height: '100%' };
    return BUDAPEST_ZONE;
  }, [zone?.maskUrl]);

  const productBaseUrl = baseImageUrl || zone?.baseImageUrl || zone?.maskUrl;
  const canRemoveBg = Boolean(logoUrl) && isRasterDataUrl(logoUrl) && !removingBg;

  const previewStyle = useMemo(() => {
    const scale = transform?.scale ?? 1;
    const x = transform?.x ?? 0;
    const y = transform?.y ?? 0;
    const rotation = transform?.rotation ?? 0;
    return {
      transform: `translate(${x * 40}%, ${y * 40}%) scale(${scale}) rotate(${rotation}deg)`,
      transformOrigin: 'center center',
      maxWidth: '85%',
      maxHeight: '70%',
      objectFit: 'contain',
      mixBlendMode: 'multiply'
    };
  }, [transform]);

  if (!zone) {
    return (
      <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
        Зона нанесения для этого товара пока не настроена.
      </Alert>
    );
  }

  const onFile = (file) => {
    if (!file) return;
    setBgError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setLogoUrl(dataUrl);
      onChange?.({
        zoneId: zone.id,
        scale: transform?.scale ?? 1,
        x: transform?.x ?? 0,
        y: transform?.y ?? 0,
        rotation: transform?.rotation ?? 0,
        logoDataUrl: dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  const patch = (partial) => {
    onChange?.({
      zoneId: zone.id,
      scale: transform?.scale ?? 1,
      x: transform?.x ?? 0,
      y: transform?.y ?? 0,
      rotation: transform?.rotation ?? 0,
      logoDataUrl: logoUrl || transform?.logoDataUrl,
      ...partial
    });
  };

  const onRemoveBackground = async () => {
    if (!canRemoveBg) return;
    setRemovingBg(true);
    setBgError('');
    try {
      const result = await removeCatalogLogoBackground(logoUrl);
      const next = result?.imageDataUrl;
      if (!next) throw new Error('Пустой ответ');
      setLogoUrl(next);
      patch({ logoDataUrl: next });
    } catch (err) {
      const msg = err?.message || 'Не удалось удалить фон';
      setBgError(msg.includes('502') ? 'Сервис удаления фона не ответил (таймаут или нет доступа к Hugging Face). Попробуйте ещё раз.' : msg);
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <Box>
      <Box sx={GALLERY_FRAME_SX}>
        <Box sx={galleryContentSx(true)}>
          <Box sx={PRODUCT_STAGE_SX}>
            <Box
              component="img"
              src={productBaseUrl}
              alt=""
              sx={PRODUCT_IMAGE_SX}
            />
            {!logoUrl && zone.maskUrl && (
              <Box
                sx={{
                  position: 'absolute',
                  ...zoneBox,
                  pointerEvents: 'none',
                  background: 'repeating-conic-gradient(#cfcfcf 0% 25%, #ffffff 0% 50%)',
                  backgroundSize: '10px 10px',
                  ...maskLayerSx(zone.maskUrl)
                }}
              />
            )}
            {logoUrl && (
              <Box
                sx={{
                  position: 'absolute',
                  ...zoneBox,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  ...maskLayerSx(zone.maskUrl)
                }}
              >
                <Box component="img" src={logoUrl} alt="" sx={previewStyle} />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Stack spacing={1} sx={{ mt: 1.5, maxWidth: GALLERY_MAX_PX }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            component="label"
            size="small"
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
          >
            Загрузить лого
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </Button>
          {logoUrl && (
            <Button
              size="small"
              variant="outlined"
              disabled={!canRemoveBg}
              onClick={onRemoveBackground}
              startIcon={
                removingBg ? <CircularProgress size={14} color="inherit" /> : <AutoFixHighIcon />
              }
            >
              {removingBg ? 'Удаляю фон…' : 'Убрать фон'}
            </Button>
          )}
          {zone.templateUrl && (
            <Button
              href={zone.templateUrl}
              download
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
            >
              Скачать шаблон .CDR
            </Button>
          )}
        </Stack>

        {bgError && (
          <Alert severity="warning" variant="outlined" sx={{ py: 0.25 }}>
            {bgError}
          </Alert>
        )}

        {logoUrl && !isRasterDataUrl(logoUrl) && (
          <Typography variant="caption" color="text.secondary">
            Удаление фона работает для PNG, JPEG и WebP (не для SVG).
          </Typography>
        )}

        <ButtonGroup size="small" variant="outlined" aria-label="Трансформация логотипа">
          <Button
            aria-label="Меньше"
            onClick={() => patch({ scale: Math.max(0.3, (transform?.scale ?? 1) - 0.1) })}
          >
            <RemoveIcon fontSize="small" />
          </Button>
          <Button
            aria-label="Больше"
            onClick={() => patch({ scale: Math.min(2.5, (transform?.scale ?? 1) + 0.1) })}
          >
            <AddIcon fontSize="small" />
          </Button>
          <Button aria-label="Влево" onClick={() => patch({ x: (transform?.x ?? 0) - 0.05 })}>
            <ArrowLeftIcon fontSize="small" />
          </Button>
          <Button aria-label="Вправо" onClick={() => patch({ x: (transform?.x ?? 0) + 0.05 })}>
            <ArrowRightIcon fontSize="small" />
          </Button>
          <Button aria-label="Выше" onClick={() => patch({ y: (transform?.y ?? 0) - 0.05 })}>
            <ArrowUpIcon fontSize="small" />
          </Button>
          <Button aria-label="Ниже" onClick={() => patch({ y: (transform?.y ?? 0) + 0.05 })}>
            <ArrowDownIcon fontSize="small" />
          </Button>
          <Button
            aria-label="Повернуть на 90°"
            onClick={() => patch({ rotation: ((transform?.rotation ?? 0) + 90) % 360 })}
          >
            <RotateRightIcon fontSize="small" />
          </Button>
        </ButtonGroup>

        {(zone.specs || []).length > 0 && (
          <Typography variant="caption" color="text.secondary" component="div">
            {(zone.specs || []).map((s) => `${s.label}: ${s.value}`).join(' · ')}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
