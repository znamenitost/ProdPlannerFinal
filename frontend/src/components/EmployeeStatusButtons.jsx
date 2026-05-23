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
import { useUiFeedback } from '../context/UiFeedbackContext';
import { runWorkflowWithInfoGuard } from '../utils/infoStatusWorkflow';
import {
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  STATUS_NO_ITEMS,
  STATUS_PAUSED,
  STATUS_PENDING_APPROVAL,
  canSetInfoStatus,
  isInfoStatus
} from '../constants/taskStatuses';

const blockedMenuItemSx = { opacity: 0.45 };

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
  const { confirm } = useUiFeedback();

  const status = task.statusText || 'Назначена';
  const isDone = status === STATUS_COMPLETED;
  const isStarted = status === STATUS_IN_PROGRESS;
  const isPaused = status === STATUS_PAUSED;
  const blocked = isInfoStatus(status);
  const canStart = !isDone && !isStarted && !isPaused;
  const canPause = isStarted;
  const canResume = isPaused;
  const canComplete = !isDone;
  const itemSx = blocked ? blockedMenuItemSx : undefined;

  const canSetPendingApproval = canSetInfoStatus(task, STATUS_PENDING_APPROVAL);
  const canSetNoItems = canSetInfoStatus(task, STATUS_NO_ITEMS);

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const runInfoStatus = (statusText) => () => {
    handleClose();
    if (!canSetInfoStatus(task, statusText)) return;
    onSetStatus?.(task, statusText);
  };

  const runWorkflowClick = (lifecycleAction) => async () => {
    handleClose();
    if (pending) return;
    await runWorkflowWithInfoGuard({
      task,
      statusText: status,
      confirm,
      resolveStatus: onSetStatus ? (t, target) => onSetStatus(t, target) : null,
      runAction: async () => lifecycleAction(task)
    });
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
          <MenuItem sx={itemSx} onClick={runWorkflowClick(onStart)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
          </MenuItem>
        )}
        {canPause && (
          <MenuItem sx={itemSx} onClick={runWorkflowClick(onPause)}>
            <ListItemIcon>
              <Pause fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>{STATUS_PAUSED}</ListItemText>
          </MenuItem>
        )}
        {canResume && (
          <MenuItem sx={itemSx} onClick={runWorkflowClick(onResume)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Продолжить</ListItemText>
          </MenuItem>
        )}
        {canComplete && (
          <MenuItem sx={itemSx} onClick={runWorkflowClick(onComplete)}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>{STATUS_COMPLETED}</ListItemText>
          </MenuItem>
        )}
        {hasWorkflow && hasInfo && <Divider sx={{ my: 0.5 }} />}
        {hasInfo && (
          <MenuItem disabled={!canSetPendingApproval} onClick={runInfoStatus(STATUS_PENDING_APPROVAL)}>
            <ListItemIcon>
              <FactCheck fontSize="small" color="secondary" />
            </ListItemIcon>
            <ListItemText>{STATUS_PENDING_APPROVAL}</ListItemText>
          </MenuItem>
        )}
        {hasInfo && (
          <MenuItem disabled={!canSetNoItems} onClick={runInfoStatus(STATUS_NO_ITEMS)}>
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
