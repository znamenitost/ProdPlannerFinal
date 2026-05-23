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
  isInfoStatus,
  canSetInfoStatus
} from '../constants/taskStatuses';

const blockedMenuItemSx = { opacity: 0.45 };
const menuDividerSx = { my: 0.75 };

export default function TaskAdminActionStacks({
  task,
  pending = false,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus,
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
  const workflowItemSx = blocked ? blockedMenuItemSx : undefined;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const canStart = !isStarted && !isPaused;
  const canPause = isStarted;
  const startAction = isPaused ? onResume : onStart;

  const runWorkflow = (lifecycleAction) => async (event) => {
    event.stopPropagation();
    handleClose();
    if (pending) return;
    await runWorkflowWithInfoGuard({
      task,
      statusText: status,
      confirm,
      resolveStatus: onSetStatus
        ? (t, target) => onSetStatus(t, target)
        : null,
      runAction: async () => lifecycleAction(task)
    });
  };

  const runInfo = (statusText) => (event) => {
    event.stopPropagation();
    handleClose();
    if (pending || !onSetStatus || !canSetInfoStatus(task, statusText)) return;
    onSetStatus(task, statusText);
  };

  const canSetPendingApproval = canSetInfoStatus(task, STATUS_PENDING_APPROVAL);
  const canSetNoItems = canSetInfoStatus(task, STATUS_NO_ITEMS);

  const showWorkflowBlock = showWorkflow && !isDone;
  const showInfoBlock = Boolean(onSetStatus);

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

        {showWorkflowBlock && (
          <>
            <Divider sx={menuDividerSx} />
            <MenuItem
              disabled={!blocked && !canStart && !isPaused}
              sx={workflowItemSx}
              onClick={runWorkflow(startAction)}
            >
              <ListItemIcon>
                <PlayArrow fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!blocked && !canPause}
              sx={workflowItemSx}
              onClick={runWorkflow(onPause)}
            >
              <ListItemIcon>
                <Pause fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>{STATUS_PAUSED}</ListItemText>
            </MenuItem>
            <MenuItem sx={workflowItemSx} onClick={runWorkflow(onComplete)}>
              <ListItemIcon>
                <CheckCircle fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>{STATUS_COMPLETED}</ListItemText>
            </MenuItem>
          </>
        )}

        {showInfoBlock && (
          <>
            <Divider sx={menuDividerSx} />
            <MenuItem disabled={!canSetPendingApproval} onClick={runInfo(STATUS_PENDING_APPROVAL)}>
              <ListItemIcon>
                <FactCheck fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText>{STATUS_PENDING_APPROVAL}</ListItemText>
            </MenuItem>
            <MenuItem disabled={!canSetNoItems} onClick={runInfo(STATUS_NO_ITEMS)}>
              <ListItemIcon>
                <Inventory2 fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText>{STATUS_NO_ITEMS}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
