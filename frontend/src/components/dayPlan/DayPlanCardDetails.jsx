import { Box, IconButton, Typography } from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import TaskCommentCell from '../taskTable/TaskCommentCell';
import { getDayPlanAssigneeNames } from '../../utils/dayPlanCardIdentity';

export default function DayPlanCardDetails({
  task,
  employee = '',
  isAdmin = false,
  onOpenComment,
  onOpenAssignees
}) {
  const assignees = getDayPlanAssigneeNames(task, employee);
  const canSwapAssignees = Boolean(isAdmin && onOpenAssignees);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Комментарий
        </Typography>
        <Box sx={{ mt: 0.25 }}>
          <TaskCommentCell
            task={task}
            onOpenComment={(commentTask) => onOpenComment?.(commentTask)}
            framed
          />
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Сотрудники
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}
          >
            {assignees.join(', ') || '—'}
          </Typography>
          {canSwapAssignees && (
            <IconButton
              size="small"
              aria-label="Сменить сотрудников"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAssignees(task);
              }}
            >
              <SwapHoriz fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}
