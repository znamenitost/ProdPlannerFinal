import { Box, CircularProgress, Typography } from '@mui/material';
import TableTruncatedTooltip from './TableTruncatedTooltip';
import { needsTooltip, truncateText, cellDisplayTextSx } from '../../utils/taskTableStyles';

export function taskFileShowsOnlineDot(task) {
  return Boolean(task?.hasCdrPreview);
}

export function CdrPreviewFileMark({ task = null, previewBuilding = false }) {
  const showDot = task ? taskFileShowsOnlineDot(task) : false;
  if (previewBuilding) {
    return (
      <CircularProgress
        size={12}
        thickness={6}
        aria-label="Построение превью"
        sx={{ flexShrink: 0 }}
      />
    );
  }

  return (
    <Box
      component="span"
      title={showDot ? 'Файл найден' : undefined}
      aria-label={showDot ? 'Файл найден' : undefined}
      aria-hidden={showDot ? undefined : true}
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: showDot ? 'success.main' : 'transparent',
        boxShadow: showDot
          ? (theme) => `0 0 0 1px ${theme.palette.success.dark}`
          : 'none'
      }}
    />
  );
}

export default function TaskFileNameCell({
  fileName = '',
  task = null,
  textLimit,
  previewBuilding = false
}) {
  const limit = textLimit ?? 40;
  const name = fileName || '—';
  const dotSlot = <CdrPreviewFileMark task={task} previewBuilding={previewBuilding} />;

  return (
    <TableTruncatedTooltip fullText={fileName} limit={limit}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%' }}>
        {dotSlot}
        <Typography variant="body2" component="span" sx={cellDisplayTextSx}>
          {needsTooltip(name, limit) ? truncateText(name, limit) : name}
        </Typography>
      </Box>
    </TableTruncatedTooltip>
  );
}
