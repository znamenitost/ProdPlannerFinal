import { useMemo } from 'react';
import { TableRow, TableCell, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import useClockMinute from '../../hooks/useClockMinute';
import {
  getPlannedTimeProgress,
  shouldShowPlannedTimeBar
} from '../../utils/plannedTimeProgress';

/** Отдельная строка под задачей — тонкий плановый прогресс по времени. */
export default function TaskPlannedProgressFooter({ task, colSpan, hideForSplitParent = false }) {
  const tick = useClockMinute(true);

  const percent = useMemo(
    () => getPlannedTimeProgress(task),
    [task, tick]
  );

  if (hideForSplitParent || !shouldShowPlannedTimeBar(task)) {
    return null;
  }

  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        sx={{
          p: 0,
          height: 5,
          lineHeight: 0,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper'
        }}
      >
        <LinearProgress
          variant="determinate"
          value={percent}
          aria-label={`Плановый прогресс ${percent}%`}
          sx={(theme) => ({
            height: 5,
            borderRadius: 0,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            '& .MuiLinearProgress-bar': {
              borderRadius: 0,
              bgcolor: alpha(theme.palette.primary.dark, 0.36)
            }
          })}
        />
      </TableCell>
    </TableRow>
  );
}
