import { Box } from '@mui/material';

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
  bgcolor: theme.palette.grey[800],
  color: theme.palette.grey[50],
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
  color: theme.palette.grey[800],
  border: '2px solid',
  borderColor: theme.palette.grey[700],
  verticalAlign: 'middle',
  lineHeight: 0,
  fontSize: markFontSize(size),
  fontWeight: 700,
  boxSizing: 'border-box'
});

/** Кружок очереди: выбранный — чёрный, свободный — обводка без заливки. */
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
