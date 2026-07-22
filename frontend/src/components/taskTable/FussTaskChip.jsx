import { Box } from '@mui/material';
import { Bolt } from '@mui/icons-material';
import LazyTooltip from '../common/LazyTooltip';

export function FussTaskMark({ size = 22, iconSize = 14 }) {
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
      <Bolt sx={{ fontSize: iconSize }} />
    </Box>
  );
}

export default function FussTaskChip({ task }) {
  if (!task?.isFuss) return null;

  return (
    <LazyTooltip title="Суета" arrow>
      <Box component="span" aria-label="Суета">
        <FussTaskMark />
      </Box>
    </LazyTooltip>
  );
}
