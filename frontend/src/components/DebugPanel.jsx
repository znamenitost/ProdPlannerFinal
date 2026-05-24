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
  Refresh,
  Close,
  Warning
} from '@mui/icons-material';
import { debugApi, getActiveTasks } from '../services/api';

export default function DebugPanel({ employee, onTimeChange, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [mockDate, setMockDate] = useState('2026-04-27T10:00');
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [message, setMessage] = useState(null);

  const showMessage = (type, text, ttlMs = 3000) => {
    setMessage({ type, text });
    if (ttlMs > 0) setTimeout(() => setMessage(null), ttlMs);
  };

  const loadTasks = async () => {
    try {
      const data = await getActiveTasks(employee);
      setActiveTasks(data);
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      showMessage('error', err.message || 'Не удалось загрузить активные задачи');
    }
  };

  useEffect(() => {
    if (open && employee) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  const handleSetMockTime = async () => {
    try {
      await debugApi.setMockTime(mockDate);
      showMessage('success', `Время установлено: ${mockDate}`);
      setIsDebugMode(true);
      onTimeChange?.();
    } catch (err) {
      showMessage('error', err.message || 'Ошибка установки времени');
    }
  };

  const handleResetTime = async () => {
    try {
      await debugApi.resetMockTime();
      showMessage('success', 'Время сброшено на реальное');
      setIsDebugMode(false);
      onTimeChange?.();
    } catch (err) {
      showMessage('error', err.message || 'Ошибка сброса времени');
    }
  };

  const handleCloseInterval = async (taskId) => {
    try {
      await debugApi.closeInterval(taskId);
      showMessage('success', `Интервал задачи ${taskId} закрыт`, 2000);
      await loadTasks();
      onRefresh?.();
    } catch (err) {
      showMessage('error', err.message || 'Ошибка закрытия интервала');
    }
  };

  const handleCreateInterval = async (taskId) => {
    try {
      await debugApi.createInterval(taskId);
      showMessage('success', `Интервал для задачи ${taskId} создан`, 2000);
      await loadTasks();
      onRefresh?.();
    } catch (err) {
      showMessage('error', err.message || 'Ошибка создания интервала');
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
              <Button variant="contained" size="small" onClick={handleSetMockTime}>
                Установить
              </Button>
              <Button variant="outlined" size="small" onClick={handleResetTime}>
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
                      onClick={() => handleCreateInterval(task.id)}
                    >
                      Создать интервал
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleCloseInterval(task.id)}
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
              onClick={() => { loadTasks(); onRefresh?.(); }}
            >
              Обновить
            </Button>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}