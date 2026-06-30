import { Box } from '@mui/material';
import { LocalFireDepartment } from '@mui/icons-material';
import LazyTooltip from '../common/LazyTooltip';
import { taskShowsPriorityMark } from '../../utils/taskPriorityMark';

export function TaskPriorityMark({ size = 22, iconSize = 14 }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        bgcolor: theme.palette.warning.main,
        color: theme.palette.common.white,
        verticalAlign: 'middle',
        lineHeight: 0
      })}
    >
      <LocalFireDepartment sx={{ fontSize: iconSize }} />
    </Box>
  );
}

export default function TaskPriorityChip({ task, childrenTasks = null }) {
  if (!taskShowsPriorityMark(task, childrenTasks)) return null;

  return (
    <LazyTooltip title="В приоритете" arrow>
      <Box component="span" aria-label="В приоритете">
        <TaskPriorityMark />
      </Box>
    </LazyTooltip>
  );
}
