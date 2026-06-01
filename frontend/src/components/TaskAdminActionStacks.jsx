import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  CheckCircle,
  FactCheck,
  Inventory2,
  TaskAlt,
  AccessTime
} from '@mui/icons-material';
import { softIconButtonSx } from '../theme/surfaces';
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
const menuDividerSx = { my: 0.75 };

function infoMenuIcon(kind) {
  if (kind === 'approved') return <TaskAlt fontSize="small" color="success" />;
  if (kind === 'inStock') return <Inventory2 fontSize="small" color="success" />;
  if (kind === 'noItems') return <Inventory2 fontSize="small" color="error" />;
  return <FactCheck fontSize="small" color="secondary" />;
}

export default function TaskAdminActionStacks({
  task,
  pending = false,
  onEdit,
  onDelete,
  onIntervals,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus,
  showEdit = true,
  showWorkflow = true
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const { confirm } = useUiFeedback();

  const status = task?.statusText || 'Назначена';
  const isDone = status === STATUS_COMPLETED;
  const isStarted = status === STATUS_IN_PROGRESS;
  const isPaused = status === STATUS_PAUSED;
  const blocked = isInfoStatus(status);
  const isWaiting = status === STATUS_WAITING || task?.sequenceStartBlocked;
  const workflowItemSx = blocked || isWaiting ? blockedMenuItemSx : undefined;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const canStart = !isStarted && !isPaused;
  const canPause = isStarted;
  // «Готово» доступно только после нажатия «Начал» (или из паузы). В инфостатусах сначала
  // нужно их снять через «Начал» (workflow сам подтвердит) — это совпадает со спецификацией.
  const canComplete = isStarted || isPaused;
  const startAction = isPaused ? onResume : onStart;

  const runWorkflow = (lifecycleAction, actionLabel) => async (event) => {
    event.stopPropagation();
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

  const runInfo = (statusText) => (event) => {
    event.stopPropagation();
    handleClose();
    if (pending || !onSetStatus) return;
    onSetStatus(task, statusText);
  };

  const showWorkflowBlock = showWorkflow && !isDone;
  const showInfoBlock = Boolean(onSetStatus);
  const infoMenuItems = getInfoMenuItems(status);

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
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {showEdit && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
              onEdit();
            }}
          >
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Редактировать</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
            onDelete();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Удалить</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
            onIntervals?.();
          }}
        >
          <ListItemIcon>
            <AccessTime fontSize="small" />
          </ListItemIcon>
          <ListItemText>Интервалы</ListItemText>
        </MenuItem>

        {showWorkflowBlock && (
          <>
            <Divider sx={menuDividerSx} />
            <MenuItem
              disabled={!canStart && !isPaused}
              sx={workflowItemSx}
              onClick={runWorkflow(startAction, STATUS_IN_PROGRESS)}
            >
              <ListItemIcon>
                <PlayArrow fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
            </MenuItem>
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
            {canComplete && (
              <MenuItem sx={workflowItemSx} onClick={runWorkflow(onComplete, STATUS_COMPLETED)}>
                <ListItemIcon>
                  <CheckCircle fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText>{STATUS_COMPLETED}</ListItemText>
              </MenuItem>
            )}
          </>
        )}

        {showInfoBlock && infoMenuItems.length > 0 && (
          <>
            <Divider sx={menuDividerSx} />
            {infoMenuItems.map((item) => (
              <MenuItem key={item.statusText} onClick={runInfo(item.statusText)}>
                <ListItemIcon>{infoMenuIcon(item.kind)}</ListItemIcon>
                <ListItemText>{item.label}</ListItemText>
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
    </>
  );
}
