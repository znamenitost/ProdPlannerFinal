import { TableRow, TableCell, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COL_ACTIONS } from '../../utils/taskTableStyles';

export default function TaskPlannedProgressFooter({ task, colSpan, hideForSplitParent = false }) {
  const show = task.showPlannedTimeProgress ?? false;

  if (hideForSplitParent || !show) {
    return null;
  }

  const percent = Math.min(
    100,
    Math.max(0, task.plannedTimeProgress ?? 0)
  );

  return (
    <TableRow>
      <TableCell
        colSpan={Math.max(1, colSpan - 1)}
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
      <TableCell
        sx={{
          ...COL_ACTIONS,
          p: 0,
          height: 5,
          lineHeight: 0,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`
        }}
      />
    </TableRow>
  );
}
