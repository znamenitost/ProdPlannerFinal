import { useEffect, useRef } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { DeleteSweep, Info, Warning, Error as ErrorIcon, CheckCircle } from '@mui/icons-material';
import { useEventLogger } from '../context/EventLoggerContext';

const getIcon = (type) => {
  switch (type) {
    case 'success': return <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />;
    case 'warning': return <Warning sx={{ fontSize: 16, color: '#ff9800' }} />;
    case 'error': return <ErrorIcon sx={{ fontSize: 16, color: '#f44336' }} />;
    default: return <Info sx={{ fontSize: 16, color: '#2196f3' }} />;
  }
};

export default function EventConsole() {
  const { events, clearEvents } = useEventLogger();
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <Paper elevation={2} sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>📋 Журнал событий</Typography>
          <IconButton size="small" onClick={clearEvents} disabled>
            <DeleteSweep fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1 }}>
          События будут отображаться здесь
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>📋 Журнал событий</Typography>
        <Tooltip title="Очистить лог">
          <IconButton size="small" onClick={clearEvents}>
            <DeleteSweep fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        ref={containerRef}
        sx={{
          maxHeight: '150px',
          overflowY: 'auto',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          p: 1,
          borderRadius: 1,
        }}
      >
        {events.map((event) => (
          <Box key={event.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, fontFamily: 'monospace' }}>
            <Chip label={event.timestamp} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#333' }} />
            {getIcon(event.type)}
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#fff' }}>
              {event.message}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}