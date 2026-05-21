import { Box, Typography } from '@mui/material';
import { getLastPathSegment } from '../utils/taskHelpers';

/** Заголовок (столбец «Задача») + имя файла (столбец «Файл»), как в таблице. */
export function getTaskHeading(task) {
  if (!task) return '—';
  const fromPath = getLastPathSegment(task.folderPath);
  if (fromPath) return fromPath;
  if (task.heading) return task.heading;
  if (task.title) return task.title;
  return task.folderPath || '—';
}

export function getTaskFileLabel(task) {
  if (!task) return '—';
  if (task.fileName) return task.fileName;
  if (task.file) {
    const parts = String(task.file).replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || task.file;
  }
  return '—';
}

export default function TaskTitleTwoLines({
  task,
  headingVariant = 'subtitle2',
  fileVariant = 'caption',
  headingSx,
  fileSx,
  sx
}) {
  const heading = getTaskHeading(task);
  const fileLabel = getTaskFileLabel(task);

  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Typography
        variant={headingVariant}
        sx={{
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...headingSx
        }}
      >
        {heading}
      </Typography>
      <Typography
        variant={fileVariant}
        color="text.secondary"
        sx={{
          display: 'block',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...fileSx
        }}
      >
        {fileLabel}
      </Typography>
    </Box>
  );
}
