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
  Inventory2,
  TaskAlt
} from '@mui/icons-material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { runWorkflowWithSequenceGuard } from '../utils/supplyStatusWorkflow';
import {
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED,
  STATUS_WAITING,
  getInfoMenuItems,
  isInfoStatus
} from '../constants/taskStatuses';

const blockedMenuItemSx = { opacity: 0.45 };

function infoMenuIcon(kind) {
  if (kind === 'approved') return <TaskAlt fontSize="small" color="success" />;
  if (kind === 'inStock') return <Inventory2 fontSize="small" color="success" />;
  if (kind === 'noItems') return <Inventory2 fontSize="small" color="error" />;
  return <FactCheck fontSize="small" color="secondary" />;
}

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
  const isInfo = isInfoStatus(status);
  const isWaiting = status === STATUS_WAITING || task?.sequenceStartBlocked;
  const canStart = !isDone && !isStarted && !isPaused;
  const canPause = isStarted;
  const canResume = isPaused;
  // «Готово» становится доступным только после нажатия «Начал» (либо в паузе после старта).
  // Это совпадает со спецификацией: до старта работа не считается, и завершать нечего.
  const canComplete = !isDone && (isStarted || isPaused);
  const workflowItemSx = isInfo || isWaiting ? blockedMenuItemSx : undefined;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const runWorkflow = (lifecycleAction, actionLabel) => async () => {
    handleClose();
    if (pending) return;
    await runWorkflowWithSequenceGuard({
      task,
      statusText: status,
      confirm,
      resolveStatus: onSetStatus
        ? (t, target, extra) => onSetStatus(t, target, extra)
        : null,
      runAction: async () => lifecycleAction(task),
      actionLabel
    });
  };

  const runInfoStatus = (statusText) => () => {
    handleClose();
    if (pending || !onSetStatus) return;
    onSetStatus(task, statusText);
  };

  if (isDone) return null;

  const hasWorkflow = canStart || canPause || canResume || canComplete || isInfo;
  const hasInfo = Boolean(onSetStatus);
  if (!hasWorkflow && !hasInfo) return null;

  const infoMenuItems = getInfoMenuItems(status);

  return (
    <>
      <IconButton
        size="small"
        variant="soft"
        color="primary"
        onClick={handleOpen}
        disabled={pending}
        aria-label="Действия с задачей"
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
        {(canStart || isInfo) && (
          <MenuItem
            sx={workflowItemSx}
            onClick={runWorkflow(onStart, STATUS_IN_PROGRESS)}
          >
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
          </MenuItem>
        )}
        {canPause && (
          <MenuItem
            sx={workflowItemSx}
            onClick={runWorkflow(onPause, STATUS_PAUSED)}
          >
            <ListItemIcon>
              <Pause fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>{STATUS_PAUSED}</ListItemText>
          </MenuItem>
        )}
        {canResume && (
          <MenuItem onClick={runWorkflow(onResume, 'Продолжить')}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Продолжить</ListItemText>
          </MenuItem>
        )}
        {canComplete && (
          <MenuItem
            sx={workflowItemSx}
            onClick={runWorkflow(onComplete, STATUS_COMPLETED)}
          >
            <ListItemIcon>
              <CheckCircle fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>{STATUS_COMPLETED}</ListItemText>
          </MenuItem>
        )}
        {hasWorkflow && hasInfo && infoMenuItems.length > 0 && <Divider sx={{ my: 0.5 }} />}
        {hasInfo &&
          infoMenuItems.map((item) => (
            <MenuItem key={item.statusText} onClick={runInfoStatus(item.statusText)}>
              <ListItemIcon>{infoMenuIcon(item.kind)}</ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
      </Menu>
    </>
  );
}
