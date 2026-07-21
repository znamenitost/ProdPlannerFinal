import { Box } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import LazyTooltip from '../common/LazyTooltip';

/** Маркер «выдан без статуса Готово». */
export function IssuedWithoutReadyMark({ size = 22, iconSize = 14 }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        bgcolor: theme.palette.info.main,
        color: theme.palette.common.white,
        verticalAlign: 'middle',
        lineHeight: 0
      })}
    >
      <HelpOutline sx={{ fontSize: iconSize }} />
    </Box>
  );
}

export default function IssuedWithoutReadyChip({ task }) {
  if (!task?.issuedWithoutReady) return null;

  return (
    <LazyTooltip title="Выдан без статуса «Готово»" arrow>
      <Box component="span" aria-label="Выдан без статуса Готово">
        <IssuedWithoutReadyMark />
      </Box>
    </LazyTooltip>
  );
}
