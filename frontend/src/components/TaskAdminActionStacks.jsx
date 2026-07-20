import { useState, Fragment } from 'react';
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
  AccessTime,
  LocalFireDepartment,
  Notifications,
  NotificationsActive,
  Link as LinkIcon
} from '@mui/icons-material';
import {
  ACTION_RESUME,
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED,
  STATUS_WAITING,
  getInfoMenuItems,
  isFinishedStatusText,
  isInfoStatus
} from '../constants/taskStatuses';

const blockedMenuItemSx = { opacity: 0.45 };
const menuDividerSx = { my: 0.75 };

function infoMenuIcon(kind) {
  if (kind === 'approved') return <TaskAlt fontSize="small" color="success" />;
  if (kind === 'inStock') return <Inventory2 fontSize="small" color="success" />;
  if (kind === 'noItems') return <Inventory2 fontSize="small" color="error" />;
  return <FactCheck fontSize="small" color="warning" />;
}

export default function TaskAdminActionStacks({
  task,
  pending = false,
  lifecycleBusy = false,
  onEdit,
  onDelete,
  onCopyOrderLink,
  onIntervals,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus,
  onTogglePriority,
  showEdit = true,
  showWorkflow = true,
  maxSubscribed = false,
  maxCanSubscribe = false,
  onMaxSubscribeToggle
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const statusWorkflowDisabled = pending || lifecycleBusy;
  const priorityMarkDisabled = pending;

  const status = task?.statusText || 'Назначена';
  const isDone = isFinishedStatusText(status);
  const isStarted = status === STATUS_IN_PROGRESS;
  const isPaused = status === STATUS_PAUSED;
  const blocked = isInfoStatus(status);
  const isWaiting = status === STATUS_WAITING || task?.sequenceStartBlocked;
  const workflowItemSx = blocked || isWaiting ? blockedMenuItemSx : undefined;

  const handleOpen = (event) => {
    event.stopPropagation();
    event.currentTarget?.blur?.();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') {
      active.blur();
    }
    setAnchorEl(null);
  };

  const canStart = !isStarted && !isPaused;
  const canPause = isStarted;
  const canResume = isPaused;
  // «Готово» доступно только после нажатия «Начал» (или из паузы). В инфостатусах сначала
  // нужно их снять через «Начал» (workflow сам подтвердит) — это совпадает со спецификацией.
  const canComplete = isStarted || isPaused;

  const runWorkflow = (lifecycleAction) => (event) => {
    event.stopPropagation();
    handleClose();
    if (statusWorkflowDisabled) return;
    void Promise.resolve(lifecycleAction(task)).catch((err) => {
      console.error('Ошибка действия с задачей:', err);
    });
  };

  const runInfo = (statusText) => (event) => {
    event.stopPropagation();
    handleClose();
    if (statusWorkflowDisabled || !onSetStatus) return;
    void Promise.resolve(onSetStatus(task, statusText)).catch((err) => {
      console.error('Ошибка смены статуса задачи:', err);
    });
  };

  const runPriorityMark = (marked) => (event) => {
    event.stopPropagation();
    handleClose();
    if (priorityMarkDisabled || !onTogglePriority) return;
    void Promise.resolve(onTogglePriority(task, marked)).catch((err) => {
      console.error('Ошибка смены пометки задачи:', err);
    });
  };

  const showWorkflowBlock = showWorkflow && !isDone;
  const infoMenuItems = getInfoMenuItems(status);
  const showInfoBlock = Boolean(onSetStatus) && infoMenuItems.length > 0;

  const sections = [];

  // 1. Редактировать / Удалить
  const editDeleteItems = [];
  if (showEdit) {
    editDeleteItems.push(
      <MenuItem
        key="edit"
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
    );
  }
  if (onDelete) {
    editDeleteItems.push(
      <MenuItem
        key="delete"
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
    );
  }
  if (onTogglePriority) {
    editDeleteItems.push(
      <MenuItem
        key="priority"
        disabled={priorityMarkDisabled}
        onClick={runPriorityMark(!task?.isPriorityMarked)}
      >
        <ListItemIcon>
          <LocalFireDepartment fontSize="small" color="warning" />
        </ListItemIcon>
        <ListItemText>
          {task?.isPriorityMarked ? 'Убрать пометку' : 'Пометить'}
        </ListItemText>
      </MenuItem>
    );
  }
  if (editDeleteItems.length > 0) sections.push(editDeleteItems);

  // 2. Начал / Пауза / Готово
  if (showWorkflowBlock) {
    const workflowItems = [];
    if (canStart || blocked) {
      workflowItems.push(
        <MenuItem
          key="start"
          disabled={statusWorkflowDisabled}
          sx={workflowItemSx}
          onClick={runWorkflow(onStart)}
        >
          <ListItemIcon>
            <PlayArrow fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>{STATUS_IN_PROGRESS}</ListItemText>
        </MenuItem>
      );
    }
    if (canResume) {
      workflowItems.push(
        <MenuItem
          key="resume"
          disabled={statusWorkflowDisabled}
          sx={workflowItemSx}
          onClick={runWorkflow(onResume)}
        >
          <ListItemIcon>
            <PlayArrow fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>{ACTION_RESUME}</ListItemText>
        </MenuItem>
      );
    }
    if (canPause) {
      workflowItems.push(
        <MenuItem
          key="pause"
          disabled={statusWorkflowDisabled}
          sx={workflowItemSx}
          onClick={runWorkflow(onPause)}
        >
          <ListItemIcon>
            <Pause fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText>{STATUS_PAUSED}</ListItemText>
        </MenuItem>
      );
    }
    if (canComplete) {
      workflowItems.push(
        <MenuItem
          key="complete"
          disabled={statusWorkflowDisabled}
          sx={workflowItemSx}
          onClick={runWorkflow(onComplete)}
        >
          <ListItemIcon>
            <CheckCircle fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>{STATUS_COMPLETED}</ListItemText>
        </MenuItem>
      );
    }
    if (workflowItems.length > 0) sections.push(workflowItems);
  }

  // 3. Интервалы / MAX / ссылка на заказ
  const metaItems = [];
  if (onIntervals) {
    metaItems.push(
      <MenuItem
        key="intervals"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
          onIntervals();
        }}
      >
        <ListItemIcon>
          <AccessTime fontSize="small" />
        </ListItemIcon>
        <ListItemText>Интервалы</ListItemText>
      </MenuItem>
    );
  }
  if (onMaxSubscribeToggle) {
    metaItems.push(
      <MenuItem
        key="max"
        disabled={!maxCanSubscribe && !maxSubscribed}
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
          void Promise.resolve(onMaxSubscribeToggle(task.id, !maxSubscribed)).catch((err) => {
            console.error('Ошибка подписки MAX:', err);
          });
        }}
      >
        <ListItemIcon>
          {maxSubscribed ? (
            <NotificationsActive fontSize="small" />
          ) : (
            <Notifications fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {maxSubscribed ? 'Отписаться от MAX' : 'Подписаться на MAX'}
        </ListItemText>
      </MenuItem>
    );
  }
  if (onCopyOrderLink) {
    metaItems.push(
      <MenuItem
        key="order-link"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
          void Promise.resolve(onCopyOrderLink(task)).catch((err) => {
            console.error('Ошибка копирования ссылки на заказ:', err);
          });
        }}
      >
        <ListItemIcon>
          <LinkIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Ссылка на заказ</ListItemText>
      </MenuItem>
    );
  }
  if (metaItems.length > 0) sections.push(metaItems);

  // 4. Инфостатусы: Нет изделий / Согласование / …
  if (showInfoBlock) {
    sections.push(
      infoMenuItems.map((item) => (
        <MenuItem
          key={item.statusText}
          disabled={statusWorkflowDisabled}
          onClick={runInfo(item.statusText)}
        >
          <ListItemIcon>{infoMenuIcon(item.kind)}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))
    );
  }

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
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {sections.map((items, index) => (
          <Fragment key={`section-${index}`}>
            {index > 0 && <Divider sx={menuDividerSx} />}
            {items}
          </Fragment>
        ))}
      </Menu>
    </>
  );
}
