// ./frontend/src/components/TaskTableToolbar.jsx
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { Add, Lightbulb } from '@mui/icons-material';

export default function TaskTableToolbar({ isAdmin, onAddNew, highlightMyTasks, onToggleHighlight }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
      <Typography variant="h2" sx={{ fontWeight: 600 }}>📋 Таблица задач</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Tooltip title={highlightMyTasks ? 'Выключить подсветку моих задач' : 'Включить подсветку моих задач'}>
          <IconButton 
            onClick={onToggleHighlight} 
            color={highlightMyTasks ? 'warning' : 'default'}
            sx={{ 
              border: '1px solid', 
              borderColor: highlightMyTasks ? 'warning.main' : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'scale(1.05)' }
            }}
          >
            <Lightbulb />
          </IconButton>
        </Tooltip>
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={onAddNew} sx={{ bgcolor: '#22c55e' }}>
            Новая задача
          </Button>
        )}
      </Box>
    </Box>
  );
}