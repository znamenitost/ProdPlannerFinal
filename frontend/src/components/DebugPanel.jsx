import { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Alert,
  IconButton,
  Collapse,
  Chip
} from '@mui/material';
import { 
  BugReport, 
  Schedule, 
  PlayArrow, 
  Stop, 
  Refresh,
  Close,
  Warning
} from '@mui/icons-material';

export default function DebugPanel({ employee, onTimeChange, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [mockDate, setMockDate] = useState('2026-04-27T10:00');
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [message, setMessage] = useState(null);

  // Загружаем активные задачи для отладки
  const loadTasks = async () => {
    try {
      const res = await fetch(`/api/tasks/active?employee=${encodeURIComponent(employee)}`);
      const data = await res.json();
      setActiveTasks(data);
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
    }
  };

  useEffect(() => {
    if (open) loadTasks();
  }, [open, employee]);

  // Установить моковое время в бэкенде
  const setMockTime = async () => {
    try {
      const res = await fetch('/api/debug/set-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockDateTime: mockDate })
      });
      const data = await res.json();
      setMessage({ type: 'success', text: `Время установлено: ${mockDate}` });
      setIsDebugMode(true);
      if (onTimeChange) onTimeChange();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка установки времени' });
    }
  };

  // Сбросить время на реальное
  const resetTime = async () => {
    try {
      await fetch('/api/debug/reset-time', { method: 'POST' });
      setMessage({ type: 'success', text: 'Время сброшено на реальное' });
      setIsDebugMode(false);
      if (onTimeChange) onTimeChange();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка сброса времени' });
    }
  };

  // Принудительно закрыть интервал задачи
  const closeInterval = async (taskId) => {
    try {
      await fetch(`/api/debug/close-interval/${taskId}`, { method: 'POST' });
      setMessage({ type: 'success', text: `Интервал задачи ${taskId} закрыт` });
      loadTasks();
      if (onRefresh) onRefresh();
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка закрытия интервала' });
    }
  };

  // Создать новый интервал для задачи
  const createInterval = async (taskId) => {
    try {
      await fetch(`/api/debug/create-interval/${taskId}`, { method: 'POST' });
      setMessage({ type: 'success', text: `Интервал для задачи ${taskId} создан` });
      loadTasks();
      if (onRefresh) onRefresh();
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка создания интервала' });
    }
  };

  return (
    <>
      {/* Кнопка открытия панели отладки */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<BugReport />}
        onClick={() => setOpen(!open)}
        sx={{ 
          position: 'fixed', 
          bottom: 16, 
          right: 16, 
          zIndex: 1000,
          bgcolor: 'background.paper',
          boxShadow: 2
        }}
      >
        {open ? 'Скрыть отладку' : 'Отладка'}
      </Button>

      <Collapse in={open}>
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'fixed', 
            bottom: 70, 
            right: 16, 
            width: 400, 
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 999,
            p: 2,
            maxHeight: '80vh',
            overflow: 'auto'
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">
                <BugReport sx={{ fontSize: 'small', mr: 1, verticalAlign: 'middle' }} />
                Панель отладки
              </Typography>
              <IconButton size="small" onClick={() => setOpen(false)}>
                <Close fontSize="small" />
              </IconButton>
            </Box>

            {isDebugMode && (
              <Chip 
                icon={<Warning />} 
                label="Режим отладки включён" 
                color="warning" 
                size="small" 
                variant="outlined"
              />
            )}

            {message && (
              <Alert severity={message.type} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            {/* Управление временем */}
            <Typography variant="subtitle2">Управление временем</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
              <TextField
                type="datetime-local"
                size="small"
                value={mockDate}
                onChange={(e) => setMockDate(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button variant="contained" size="small" onClick={setMockTime}>
                Установить
              </Button>
              <Button variant="outlined" size="small" onClick={resetTime}>
                Сброс
              </Button>
            </Box>

            {/* Управление интервалами */}
            <Typography variant="subtitle2">Активные задачи</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
              {activeTasks.map(task => (
                <Paper key={task.id} variant="outlined" sx={{ p: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                    {(() => { const label = task.title || task.fileName || `Задача ${task.id}`; return label.length > 40 ? `${label.substring(0, 40)}…` : label; })()}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mt: 0.5 }}>
                    <Chip 
                      size="small" 
                      label={task.status === 1 ? 'InProgress' : 'Assigned'}
                      color={task.status === 1 ? 'success' : 'default'}
                    />
                    <Chip 
                      size="small" 
                      icon={<Schedule />} 
                      label={`${task.progress * 100}%`}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mt: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => createInterval(task.id)}
                    >
                      Создать интервал
                    </Button>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error"
                      onClick={() => closeInterval(task.id)}
                    >
                      Закрыть интервал
                    </Button>
                  </Box>
                </Paper>
              ))}
              {activeTasks.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Нет активных задач
                </Typography>
              )}
            </Box>

            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<Refresh />}
              onClick={() => { loadTasks(); if (onRefresh) onRefresh(); }}
            >
              Обновить
            </Button>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}