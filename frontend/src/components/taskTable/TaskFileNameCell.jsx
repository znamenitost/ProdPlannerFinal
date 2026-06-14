import { Box, Typography } from '@mui/material';
import LazyTooltip from '../common/LazyTooltip';
import { needsTooltip, truncateText, cellDisplayTextSx } from '../../utils/taskTableStyles';

export function taskFileShowsOnlineDot(task) {
  return Boolean(task?.hasCdrPreview || task?.fileFoundOnline);
}

export default function TaskFileNameCell({ fileName = '', task = null, textLimit }) {
  const limit = textLimit ?? 40;
  const name = fileName || '—';
  const showDot = task ? taskFileShowsOnlineDot(task) : false;
  const dot = showDot ? (
    <Box
      component="span"
      title="Файл найден"
      aria-label="Файл найден"
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: 'success.main',
        flexShrink: 0,
        boxShadow: (theme) => `0 0 0 1px ${theme.palette.success.dark}`
      }}
    />
  ) : null;

  const content = (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%' }}>
      <Typography variant="body2" component="span" sx={cellDisplayTextSx}>
        {needsTooltip(name, limit) ? truncateText(name, limit) : name}
      </Typography>
      {dot}
    </Box>
  );

  if (needsTooltip(name, limit)) {
    return (
      <LazyTooltip title={fileName} arrow>
        {content}
      </LazyTooltip>
    );
  }

  return content;
}
