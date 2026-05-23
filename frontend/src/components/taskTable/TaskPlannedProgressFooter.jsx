import { TableRow, TableCell, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';

export default function TaskPlannedProgressFooter({ task, colSpan, hideForSplitParent = false }) {
  const show =
    task.showPlannedTimeProgress ??
    task.ShowPlannedTimeProgress ??
    false;

  if (hideForSplitParent || !show) {
    return null;
  }

  const percent = Math.min(
    100,
    Math.max(0, task.plannedTimeProgress ?? task.PlannedTimeProgress ?? 0)
  );

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
