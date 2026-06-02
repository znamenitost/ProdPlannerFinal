// ./frontend/src/components/TaskTableToolbar.jsx
import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, Lightbulb, Sort, TableChart } from '@mui/icons-material';
import { sectionHeaderSx, sectionTitleRowSx } from '../theme/surfaces';
import TaskTableColumnSettings from './taskTable/TaskTableColumnSettings';

export default function TaskTableToolbar({
  isAdmin,
  onAddNew,
  highlightMyTasks,
  onToggleHighlight,
  columnVisibility,
  onColumnVisibleChange,
  onColumnVisibilityReset,
  textLimit,
  onTextLimitChange,
  completedBottomSort,
  onCompletedBottomSortChange
}) {
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const sortMenuOpen = Boolean(sortAnchorEl);

  const handleOpenSortMenu = (event) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleCloseSortMenu = () => {
    setSortAnchorEl(null);
  };

  return (
    <Box sx={{ ...sectionHeaderSx, mb: 2 }}>
      <Box sx={sectionTitleRowSx}>
        <TableChart color="primary" />
        <Typography variant="h2" component="h2">Таблица задач</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Tooltip title={highlightMyTasks ? 'Выключить подсветку моих задач' : 'Включить подсветку моих задач'}>
          <IconButton
            variant="soft"
            color={highlightMyTasks ? 'warning' : 'primary'}
            onClick={onToggleHighlight}
            sx={highlightMyTasks && { border: '1px solid', borderColor: 'warning.main' }}
          >
            <Lightbulb />
          </IconButton>
        </Tooltip>
        <Tooltip title="Сортировка">
          <IconButton
            variant="soft"
            color="primary"
            onClick={handleOpenSortMenu}
            sx={completedBottomSort && { border: '1px solid', borderColor: 'primary.main' }}
          >
            <Sort />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={sortAnchorEl}
          open={sortMenuOpen}
          onClose={handleCloseSortMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => onCompletedBottomSortChange(!completedBottomSort)}>
            <Checkbox size="small" checked={completedBottomSort} readOnly />
            <ListItemText primary="Готовые всегда снизу" />
          </MenuItem>
        </Menu>
        <TaskTableColumnSettings
          visibility={columnVisibility}
          onColumnVisibleChange={onColumnVisibleChange}
          onReset={onColumnVisibilityReset}
          textLimit={textLimit}
          onTextLimitChange={onTextLimitChange}
        />
        {isAdmin && (
          <Button variant="contained" color="success" startIcon={<Add />} onClick={onAddNew}>
            Новая задача
          </Button>
        )}
      </Box>
    </Box>
  );
}