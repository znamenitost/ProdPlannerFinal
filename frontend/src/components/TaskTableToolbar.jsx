// ./frontend/src/components/TaskTableToolbar.jsx
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { Add, Lightbulb, TableChart } from '@mui/icons-material';
import { sectionHeaderSx, sectionTitleRowSx, softIconButtonSx } from '../theme/surfaces';
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
  onTextLimitChange
}) {
  return (
    <Box sx={{ ...sectionHeaderSx, mb: 2 }}>
      <Box sx={sectionTitleRowSx}>
        <TableChart color="primary" />
        <Typography variant="h2" component="h2">Таблица задач</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Tooltip title={highlightMyTasks ? 'Выключить подсветку моих задач' : 'Включить подсветку моих задач'}>
          <IconButton
            onClick={onToggleHighlight}
            color={highlightMyTasks ? 'warning' : 'default'}
            sx={[
              softIconButtonSx(highlightMyTasks ? 'warning' : 'primary'),
              highlightMyTasks && { border: '1px solid', borderColor: 'warning.main' }
            ]}
          >
            <Lightbulb />
          </IconButton>
        </Tooltip>
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