import { Box, Button } from '@mui/material';
import { PlayArrow, Pause, CheckCircle } from '@mui/icons-material';
import { compactActionButtonSx } from '../theme/surfaces';

export default function EmployeeStatusButtons({
  task,
  pending = false,
  onStart,
  onPause,
  onResume,
  onComplete
}) {
  const status = task.statusText || 'Назначена';
  const isDone = status === 'Готово';
  const isStarted = status === 'Начал';
  const isPaused = status === 'Пауза';
  const canStart = !isDone && !isStarted && !isPaused;
  const isDisabled = pending;

  const handlePauseClick = () => {
    if (isPaused) onResume(task);
    else onPause(task);
  };

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center' }}>
      <Button
        size="small"
        variant={isStarted ? 'contained' : 'outlined'}
        color="success"
        disabled={!canStart || isDisabled}
        startIcon={<PlayArrow sx={{ fontSize: '14px !important' }} />}
        onClick={() => onStart(task)}
        sx={compactActionButtonSx}
      >
        Начал
      </Button>
      <Button
        size="small"
        variant={isPaused ? 'contained' : 'outlined'}
        color="warning"
        disabled={isDone || (!isStarted && !isPaused) || isDisabled}
        startIcon={<Pause sx={{ fontSize: '14px !important' }} />}
        onClick={handlePauseClick}
        sx={compactActionButtonSx}
      >
        Пауза
      </Button>
      <Button
        size="small"
        variant={isDone ? 'contained' : 'outlined'}
        color="primary"
        disabled={isDone || isDisabled}
        startIcon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
        onClick={() => onComplete(task)}
        sx={compactActionButtonSx}
      >
        Готово
      </Button>
    </Box>
  );
}
