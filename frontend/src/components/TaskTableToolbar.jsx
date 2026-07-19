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
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, Lightbulb, LinearScale, PieChart, Settings, Sort, TableChart } from '@mui/icons-material';
import { sectionHeaderSx, sectionTitleRowSx } from '../theme/surfaces';
import TaskTableColumnSettings from './taskTable/TaskTableColumnSettings';
import ExpandableSearchField from './taskTable/ExpandableSearchField';

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
  deadlineSort,
  onDeadlineSortChange,
  completedBottomSort,
  onCompletedBottomSortChange,
  hideCompletedSort,
  onHideCompletedSortChange,
  hideCompletedInSharedSort,
  onHideCompletedInSharedSortChange,
  searchQuery,
  onSearchQueryChange,
  showPlannedProgress,
  onToggleShowPlannedProgress,
  autoSearchMinutes,
  onAutoSearchMinutesChange,
  onOpenFileOpenSettings,
  onOpenTaskTypeStats,
  taskTypeStatsOpen = false
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
      <Box sx={{ ...sectionTitleRowSx, gap: 1.5 }}>
        <TableChart color="primary" />
        <Typography variant="h2" component="h2">Таблица задач</Typography>
        {isAdmin && onOpenFileOpenSettings && (
          <Tooltip title="Файловый сервер">
            <IconButton
              variant="soft"
              color="primary"
              size="small"
              onClick={onOpenFileOpenSettings}
              aria-label="Настройки файлового сервера"
            >
              <Settings fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && onOpenTaskTypeStats && (
          <Tooltip title="Статистика по типам задач">
            <IconButton
              variant="soft"
              color="primary"
              size="small"
              onClick={onOpenTaskTypeStats}
              aria-label="Статистика по типам задач"
              disabled={taskTypeStatsOpen}
            >
              <PieChart fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <Tooltip title="SAVE: минуты до второй попытки превью CDR (0 — выкл.)">
            <TextField
              label="SAVE"
              placeholder="мин"
              type="number"
              size="small"
              value={autoSearchMinutes || ''}
              onChange={(e) => onAutoSearchMinutesChange(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 1440, step: 1, 'aria-label': 'SAVE, минуты' } }}
              sx={{
                width: 78,
                '& .MuiInputBase-root': { fontSize: '0.8125rem' },
                '& .MuiInputBase-input': { py: 0.75, px: 0.75, textAlign: 'center' },
                '& .MuiInputLabel-root': { fontSize: '0.8125rem' }
              }}
            />
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <ExpandableSearchField value={searchQuery} onChange={onSearchQueryChange} />
        <Tooltip title={highlightMyTasks ? 'Выключить подсветку моих задач' : 'Включить подсветку моих задач'}>
          <IconButton
            variant="soft"
            color={highlightMyTasks ? 'warning' : 'primary'}
            onClick={onToggleHighlight}
            aria-label={highlightMyTasks ? 'Выключить подсветку моих задач' : 'Включить подсветку моих задач'}
            sx={highlightMyTasks ? { border: '1px solid', borderColor: 'warning.main' } : undefined}
          >
            <Lightbulb />
          </IconButton>
        </Tooltip>
        {isAdmin && (
          <Tooltip title={showPlannedProgress ? 'Скрыть прогресс по времени' : 'Показать прогресс по времени'}>
            <IconButton
              variant="soft"
              color={showPlannedProgress ? 'primary' : 'default'}
              onClick={onToggleShowPlannedProgress}
              aria-label={showPlannedProgress ? 'Скрыть прогресс по времени' : 'Показать прогресс по времени'}
              aria-pressed={showPlannedProgress}
              sx={showPlannedProgress ? { border: '1px solid', borderColor: 'primary.main' } : undefined}
            >
              <LinearScale />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Сортировка">
          <IconButton
            variant="soft"
            color="primary"
            onClick={handleOpenSortMenu}
            aria-label="Сортировка таблицы задач"
            sx={
              deadlineSort || completedBottomSort || hideCompletedSort
              || hideCompletedInSharedSort
                ? { border: '1px solid', borderColor: 'primary.main' }
                : undefined
            }
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
          <MenuItem onClick={() => onDeadlineSortChange(!deadlineSort)}>
            <Checkbox
              size="small"
              checked={deadlineSort}
              disableRipple
              tabIndex={-1}
              sx={{ pointerEvents: 'none' }}
            />
            <ListItemText primary="По дедлайну" />
          </MenuItem>
          <MenuItem onClick={() => onCompletedBottomSortChange(!completedBottomSort)}>
            <Checkbox
              size="small"
              checked={completedBottomSort}
              disableRipple
              tabIndex={-1}
              sx={{ pointerEvents: 'none' }}
            />
            <ListItemText primary="Готовые всегда снизу" />
          </MenuItem>
          <MenuItem onClick={() => onHideCompletedSortChange(!hideCompletedSort)}>
            <Checkbox
              size="small"
              checked={hideCompletedSort}
              disableRipple
              tabIndex={-1}
              sx={{ pointerEvents: 'none' }}
            />
            <ListItemText primary="Готовые не показывать" />
          </MenuItem>
          <MenuItem onClick={() => onHideCompletedInSharedSortChange(!hideCompletedInSharedSort)}>
            <Checkbox
              size="small"
              checked={hideCompletedInSharedSort}
              disableRipple
              tabIndex={-1}
              sx={{ pointerEvents: 'none' }}
            />
            <ListItemText primary="Скрыть готовые в общих" />
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