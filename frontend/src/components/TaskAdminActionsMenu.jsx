import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { MoreVert, Edit, Delete, TaskAlt, Inventory } from '@mui/icons-material';
import { softIconButtonSx } from '../theme/surfaces';
import {
  STATUS_APPROVED,
  STATUS_IN_STOCK,
  STATUS_NO_ITEMS,
  STATUS_PENDING_APPROVAL
} from '../constants/taskStatuses';

export default function TaskAdminActionsMenu({
  task,
  onEdit,
  onDelete,
  onSetStatus,
  disabled = false
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const status = task?.statusText || '';
  const showApprove = status === STATUS_PENDING_APPROVAL && onSetStatus;
  const showInStock = status === STATUS_NO_ITEMS && onSetStatus;
  const showAdminBlock = showApprove || showInStock;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const run = (fn) => (event) => {
    event.stopPropagation();
    fn();
    handleClose();
  };

  const runStatus = (statusText) => (event) => {
    event.stopPropagation();
    onSetStatus(task, statusText);
    handleClose();
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        disabled={disabled}
        aria-label="Действия с задачей"
        sx={softIconButtonSx('primary')}
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={run(onEdit)}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Редактировать</ListItemText>
        </MenuItem>
        <MenuItem onClick={run(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Удалить</ListItemText>
        </MenuItem>
        {showAdminBlock && <Divider sx={{ my: 0.5 }} />}
        {showApprove && (
          <MenuItem onClick={runStatus(STATUS_APPROVED)}>
            <ListItemIcon>
              <TaskAlt fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{STATUS_APPROVED}</ListItemText>
          </MenuItem>
        )}
        {showInStock && (
          <MenuItem onClick={runStatus(STATUS_IN_STOCK)}>
            <ListItemIcon>
              <Inventory fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{STATUS_IN_STOCK}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
