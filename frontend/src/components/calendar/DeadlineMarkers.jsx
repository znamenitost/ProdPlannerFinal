import { Box, Tooltip } from '@mui/material';
import { hoverInteractiveSx } from '../../theme/motion';
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
          <DoneAll sx={{ fontSize: 16 }} color="success" />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <CheckCircle sx={{ fontSize: 12 }} color="success" /> Выполнена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: 'text.secondary' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'InProgress') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrow sx={{ fontSize: 16 }} color="info" />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Schedule sx={{ fontSize: 12 }} color="warning" /> В процессе выполнения
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: 'text.secondary' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'Assigned') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assignment sx={{ fontSize: 16 }} color="warning" />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <HourglassEmpty sx={{ fontSize: 12 }} color="secondary" /> Назначена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: 'text.secondary' }} /> Дедлайн: {deadlineStr}
        </Box>
      </Box>
    );
  }

  if (dl.status === 'Paused') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Pause sx={{ fontSize: 16 }} color="warning" />
          <strong>{title}</strong>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Pause sx={{ fontSize: 12 }} /> Приостановлена
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, mt: 0.5 }}>
          <Event sx={{ fontSize: 12, color: 'text.secondary' }} /> Дедлайн: {deadlineStr}
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
      {deadlines?.filter((dl) => dl.status !== 'Completed').map((dl, idx) => {
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
                bgcolor: dl.status === 'Completed' ? 'success.main' : 'error.main',
                borderRadius: 2,
                cursor: 'pointer',
                ...hoverInteractiveSx,
                '&:hover': { width: 6, boxShadow: (theme) => `0 0 6px ${theme.palette.grey[400]}` },
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
