import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import { MoreVert, PlayArrow, Pause, CheckCircle } from '@mui/icons-material';
import { softIconButtonSx } from '../theme/surfaces';

export default function EmployeeStatusButtons({
  task,
  pending = false,
  onStart,
  onPause,
  onResume,
  onComplete
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const status = task.statusText || 'Назначена';
  const isDone = status === 'Готово';
  const isStarted = status === 'Начал';
  const isPaused = status === 'Пауза';
  const canStart = !isDone && !isStarted && !isPaused;
  const canPause = isStarted;
  const canResume = isPaused;
  const canComplete = !isDone;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const runAction = (action) => () => {
    handleClose();
    action(task);
  };

  if (isDone) return null;

  const hasActions = canStart || canPause || canResume || canComplete;
  if (!hasActions) return null;

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
          <MenuItem onClick={runAction(onStart)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Начал</ListItemText>
          </MenuItem>
        )}
        {canPause && (
          <MenuItem onClick={runAction(onPause)}>
            <ListItemIcon>
              <Pause fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>Пауза</ListItemText>
          </MenuItem>
        )}
        {canResume && (
          <MenuItem onClick={runAction(onResume)}>
            <ListItemIcon>
              <PlayArrow fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Продолжить</ListItemText>
          </MenuItem>
        )}
        {canComplete && (
          <MenuItem onClick={runAction(onComplete)}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Готово</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
