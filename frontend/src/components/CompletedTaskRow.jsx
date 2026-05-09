import { TableRow, TableCell, Box, Typography, Chip, Tooltip } from '@mui/material';
import { CheckCircle, PlayArrow, Stop, TrendingUp, TrendingDown, CalendarToday } from '@mui/icons-material';

// Функция из taskHelpers.js (скопирована для независимости)
function getLastPathSegment(path) {
  if (!path) return '';
  const parts = path.split(/[\/\\]/).filter(p => p !== '');
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

function formatWorkPeriod(intervals) {
  if (!intervals || intervals.length === 0) return '—';
  return intervals.map(i => {
    const start = new Date(i.startTime).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
    const end = i.endTime ? new Date(i.endTime).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '...';
    return `${start} - ${end}`;
  }).join(', ');
}

function formatCompletedDate(completedAt) {
  if (!completedAt) return '—';
  const d = new Date(completedAt);
  return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}`;
}

export default function CompletedTaskRow({ task }) {
  const diff = task.estimateHours - task.actualHours;
  const isPositive = diff >= 0;
  const workPeriod = formatWorkPeriod(task.workIntervals);
  const completedDate = formatCompletedDate(task.completedAt);

  // Название задачи: как в таблице задач – последний сегмент folderPath, либо fileName, либо fallback
  const taskName = task.fileName || getLastPathSegment(task.folderPath) || 'Без названия';

  return (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle sx={{ fontSize: 16, color: '#22c55e' }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {taskName}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarToday sx={{ fontSize: 14, color: '#6b7c93' }} />
          <Typography variant="body2">{completedDate}</Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Chip label={task.type || 'Без типа'} size="small" sx={{ bgcolor: '#f1f5f9', fontSize: 12 }} />
      </TableCell>
      <TableCell align="center">
        <Tooltip title={workPeriod} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
            <PlayArrow sx={{ fontSize: 12, color: '#4caf50' }} />
            <Typography variant="caption" color="text.secondary">
              {workPeriod !== '—' ? workPeriod.substring(0, 20) + (workPeriod.length > 20 ? '...' : '') : '—'}
            </Typography>
            <Stop sx={{ fontSize: 12, color: '#f44336' }} />
          </Box>
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{task.estimateHours.toFixed(1)} ч</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="text.secondary">{task.actualHours.toFixed(1)} ч</Typography>
      </TableCell>
      <TableCell align="right">
        <Chip
          size="small"
          icon={isPositive ? <TrendingUp /> : <TrendingDown />}
          label={`${isPositive ? '+' : ''}${diff.toFixed(1)} ч`}
          sx={{
            bgcolor: isPositive ? '#dcfce7' : '#fee2e2',
            color: isPositive ? '#166534' : '#991b1b',
            fontWeight: 500,
            '& .MuiChip-icon': { color: isPositive ? '#22c55e' : '#ef4444' }
          }}
        />
      </TableCell>
    </TableRow>
  );
}