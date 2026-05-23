import { Box, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import useClockMinute from '../../hooks/useClockMinute';
import {
  getPlannedTimeProgress,
  shouldShowPlannedTimeBar
} from '../../utils/plannedTimeProgress';

/** Тонкая полоса планового прогресса по времени внизу строки таблицы. */
export default function TaskPlannedTimeBar({ task, hideForSplitParent = false }) {
  useClockMinute(true);

  if (hideForSplitParent || !shouldShowPlannedTimeBar(task)) {
    return null;
  }

  const percent = getPlannedTimeProgress(task);

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 3,
        zIndex: 2,
        pointerEvents: 'none'
      }}
      aria-hidden
    >
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={(theme) => ({
          height: 3,
          borderRadius: 0,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          '& .MuiLinearProgress-bar': {
            borderRadius: 0,
            bgcolor: alpha(theme.palette.primary.main, 0.45)
          }
        })}
      />
    </Box>
  );
}
