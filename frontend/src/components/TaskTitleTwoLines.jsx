import { Box, Typography } from '@mui/material';
import {
  STATUS_FINISHED_LABEL,
  STATUS_NO_ITEMS,
  STATUS_PENDING_APPROVAL
} from '../constants/taskStatuses';
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

/** Первая строка: «Задача / имя файла». */
export function getTaskTitleSlashFile(task) {
  const heading = getTaskHeading(task);
  const fileLabel = getTaskFileLabel(task);
  if (fileLabel === '—') return heading;
  if (heading === '—') return fileLabel;
  return `${heading} / ${fileLabel}`;
}

/** Вторая строка: статус задачи. */
export function getTaskStatusLine(task) {
  if (!task) return '';
  if (task.statusText) return task.statusText;
  if (task.status === 3) return STATUS_FINISHED_LABEL;
  if (task.status === 4) return STATUS_PENDING_APPROVAL;
  if (task.status === 5) return STATUS_NO_ITEMS;
  if (task.status === 1) return 'В работе';
  if (task.status === 2) return 'На паузе';
  if (task.status === 0) return 'Назначена';
  return '';
}

export default function TaskTitleTwoLines({
  task,
  headingVariant = 'subtitle2',
  statusVariant = 'caption',
  headingSx,
  statusSx,
  showStatus = true,
  sx
}) {
  const titleLine = getTaskTitleSlashFile(task);
  const statusLine = showStatus ? getTaskStatusLine(task) : '';

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
        {titleLine}
      </Typography>
      {statusLine ? (
        <Typography
          variant={statusVariant}
          color="text.secondary"
          sx={{
            display: 'block',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...statusSx
          }}
        >
          {statusLine}
        </Typography>
      ) : null}
    </Box>
  );
}
