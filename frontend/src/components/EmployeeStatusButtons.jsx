import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  MoreVert,
  PlayArrow,
  Pause,
  CheckCircle,
  FactCheck,
  Inventory2
} from '@mui/icons-material';
import { softIconButtonSx } from '../theme/surfaces';
import {
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  STATUS_NO_ITEMS,
  STATUS_PAUSED,
  STATUS_PENDING_APPROVAL,
  isInfoStatus
} from '../constants/taskStatuses';

export default function EmployeeStatusButtons({
  task,
  pending = false,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const status = task.statusText || 'Назначена';
  const isDone = status === STATUS_COMPLETED;
  const isStarted = status === STATUS_IN_PROGRESS;
  const isPaused = status === STATUS_PAUSED;
  const isInfo = isInfoStatus(status);
  const canStart = !isDone && !isStarted && !isPaused;
  const canPause = isStarted;
  const canResume = isPaused;
  const canComplete = !isDone;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const runLifecycle = (action) => () => {
    handleClose();
    action(task);
  };

  const runInfoStatus = (statusText) => () => {
    handleClose();
    onSetStatus(task, statusText);
  };

  const runWorkflowStatus = (statusText, lifecycleAction) => () => {
    handleClose();
    if (isInfo && onSetStatus) {
      onSetStatus(task, statusText);
    } else {
      lifecycleAction(task);
    }
  };

  if (isDone) return null;

  const hasWorkflow = canStart || canPause || canResume || canComplete;
  const hasInfo = Boolean(onSetStatus);
  if (!hasWorkflow && !hasInfo) return null;

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        disabled={pending}
        aria-label="Действия с задачей"
        sx={softIconButtonSx('primary')}
      >
        {pending ? <CircularProgress size={18} /> : <MoreVert fontSize="small" />}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canStart && (
          <MenuItem onClick={runWorkflowStatus(STATUS_IN_PROGRESS, onStart)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
          </MenuItem>
        )}
        {canPause && (
          <MenuItem onClick={runWorkflowStatus(STATUS_PAUSED, onPause)}>
            <ListItemIcon>
              <Pause fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>{STATUS_PAUSED}</ListItemText>
          </MenuItem>
        )}
        {canResume && (
          <MenuItem onClick={runWorkflowStatus(STATUS_IN_PROGRESS, onResume)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Продолжить</ListItemText>
          </MenuItem>
        )}
        {canComplete && (
          <MenuItem onClick={runWorkflowStatus(STATUS_COMPLETED, onComplete)}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>{STATUS_COMPLETED}</ListItemText>
          </MenuItem>
        )}
        {hasWorkflow && hasInfo && <Divider sx={{ my: 0.5 }} />}
        {hasInfo && (
          <MenuItem onClick={runInfoStatus(STATUS_PENDING_APPROVAL)}>
            <ListItemIcon>
              <FactCheck fontSize="small" color="secondary" />
            </ListItemIcon>
            <ListItemText>{STATUS_PENDING_APPROVAL}</ListItemText>
          </MenuItem>
        )}
        {hasInfo && (
          <MenuItem onClick={runInfoStatus(STATUS_NO_ITEMS)}>
            <ListItemIcon>
              <Inventory2 fontSize="small" color="secondary" />
            </ListItemIcon>
            <ListItemText>{STATUS_NO_ITEMS}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
