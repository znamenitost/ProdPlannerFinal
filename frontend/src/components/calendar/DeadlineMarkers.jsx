import { Box, Tooltip } from '@mui/material';
import {
  CheckCircle,
  DoneAll,
  Event,
  HourglassEmpty,
  Pause,
  PlayArrow,
  Schedule,
  Assignment
} from '@mui/icons-material';
import { CALENDAR_TOOLTIP_SX, getLeft } from '../../utils/calendarDayUtils';

function DeadlineTooltipContent({ dl, taskInfoObj }) {
  const title = taskInfoObj?.title || dl.taskTitle;
  const deadlineStr = new Date(dl.deadline).toLocaleString();

  if (dl.status === 'Completed') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DoneAll sx={{ fontSize: 16, color: '#10b981' }} />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <CheckCircle sx={{ fontSize: 12, color: '#10b981' }} /> Выполнена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: '#6b7c93' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'InProgress') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrow sx={{ fontSize: 16, color: '#3b82f6' }} />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Schedule sx={{ fontSize: 12, color: '#f59e0b' }} /> В процессе выполнения
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: '#6b7c93' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'Assigned') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assignment sx={{ fontSize: 16, color: '#f59e0b' }} />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <HourglassEmpty sx={{ fontSize: 12, color: '#94a3b8' }} /> Назначена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: '#6b7c93' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'Paused') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Pause sx={{ fontSize: 16, color: '#f59e0b' }} />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Pause sx={{ fontSize: 12 }} /> Приостановлена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: '#6b7c93' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12 }}>
      <Event sx={{ fontSize: 12 }} /> Дедлайн: {deadlineStr}
    </Box>
  );
}

export default function DeadlineMarkers({ deadlines, getTaskInfo, onTaskHover }) {
  return (
    <Box sx={{ position: 'relative', height: 20, mb: 2 }}>
      {deadlines?.map((dl, idx) => {
        const leftPos = Math.min(100, Math.max(0, getLeft(dl.deadline)));
        const taskInfoObj = getTaskInfo(dl.taskId, dl.taskTitle, dl.status);

        return (
          <Tooltip
            key={idx}
            title={<DeadlineTooltipContent dl={dl} taskInfoObj={taskInfoObj} />}
            arrow
            placement="top"
            slotProps={{ tooltip: { sx: CALENDAR_TOOLTIP_SX } }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${leftPos}%`,
                top: -10,
                transform: 'translateX(-50%)',
                width: 4,
                height: 20,
                bgcolor: dl.status === 'Completed' ? '#10b981' : '#ef4444',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { width: 6, boxShadow: '0 0 4px rgba(0,0,0,0.3)' },
                zIndex: 10
              }}
              onMouseEnter={() => onTaskHover?.(dl.taskId)}
              onMouseLeave={() => onTaskHover?.(null)}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
