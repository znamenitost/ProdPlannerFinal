import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

function markFontSize(size) {
  return Math.max(11, Math.round(size * 0.5));
}

const filledSx = (theme, size) => ({
  width: size,
  height: size,
  minWidth: size,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  bgcolor: theme.palette.error.dark,
  color: theme.palette.common.white,
  verticalAlign: 'middle',
  lineHeight: 0,
  fontSize: markFontSize(size),
  fontWeight: 700
});

const outlineSx = (theme, size) => ({
  width: size,
  height: size,
  minWidth: size,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  bgcolor: 'transparent',
  color: theme.palette.error.dark,
  border: '2px solid',
  borderColor: alpha(theme.palette.error.dark, 0.5),
  verticalAlign: 'middle',
  lineHeight: 0,
  fontSize: markFontSize(size),
  fontWeight: 700,
  boxSizing: 'border-box'
});

/** Кружок очереди: заливка как у пометки на проде (error.dark), свободный — обводка. */
export function TaskPriorityRankMark({ rank, selected = true, size = 22 }) {
  return (
    <Box
      component="span"
      sx={(theme) => (selected ? filledSx(theme, size) : outlineSx(theme, size))}
    >
      {rank}
    </Box>
  );
}
