import { useState, useEffect } from 'react';
import {
  Typography,
  Container,
  Box,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Chip,
  Tab,
  Tabs,
  Avatar,
  Menu,
  IconButton,
  Divider
} from '@mui/material';
import { 
  Today, 
  RestartAlt, 
  Notifications, 
  TableChart, 
  CalendarMonth, 
  Logout, 
  Person,
  AdminPanelSettings,
  CloudUpload,
  Delete,
  Schedule,
} from '@mui/icons-material';
import WeekCalendar from './components/WeekCalendar';
import ActiveTasksList from './components/ActiveTasksList';
import CompletedTasksList from './components/CompletedTasksList';
import DeadlineWarnings from './components/DeadlineWarnings';
import DebugPanel from './components/DebugPanel';
import SplitTaskModal from './components/SplitTaskModal';
import TaskTable from './components/TaskTable';
import LoginForm from './components/LoginForm';
import PushNotificationSnackbars from './components/PushNotificationSnackbars';
import { LoadingState } from './components/LoadingState';
import { UiFeedbackProvider, useUiFeedback } from './context/UiFeedbackContext';
import useActiveTasksRefresh from './hooks/useActiveTasksRefresh';
import useAuth from './hooks/useAuth';
import useNotificationsHub from './hooks/useNotificationsHub';

const theme = createTheme({
  palette: {
    primary: { main: '#7c9ebf', light: '#a8c4e0', dark: '#5d7f9e' },
    secondary: { main: '#cbd5e1', light: '#e2e8f0', dark: '#94a3b8' },
    success: { main: '#7c9e7c', light: '#a3b8a3', dark: '#5d7e5d' },
    error: { main: '#d48c8c', light: '#e29b9b', dark: '#b06f6f' },
    background: { default: '#f3f4f6', paper: '#ffffff' },
    text: { primary: '#374151', secondary: '#6b7c93' },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 600 },
    h2: { fontSize: '1.3rem', fontWeight: 500 },
  },
  shape: { borderRadius: 12 },
});

function AppContent() {
  const { user, setUser, loading, employee, setEmployee, handleLogin, handleLogout } = useAuth();
  const { showSuccess, showError, showWarning, showInfo, confirm } = useUiFeedback();
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const { activeTasks, refresh, refreshAll } = useActiveTasksRefresh(user, employee);
  const { notifications, closeNotification } = useNotificationsHub(user, refreshAll);

  useEffect(() => { setAnchorElUser(null); }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = handleAvatarUpload;
    input.click();
    handleCloseUserMenu();
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Пожалуйста, выберите изображение');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showWarning('Размер файла не должен превышать 2MB');
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setUser(prev => ({
        ...prev,
        avatarUrl: data.avatarUrl
      }));
      setAvatarKey(Date.now());
      showSuccess('Аватар успешно загружен');
    } catch (err) {
      showError(err.message || 'Ошибка загрузки');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarError = (e) => {
    e.target.style.display = 'none';
  };

  const handleDeleteAvatar = async () => {
    const confirmed = await confirm({
      title: 'Удалить аватар?',
      message: 'Вы уверены, что хотите удалить фото профиля?',
      confirmLabel: 'Удалить',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    setUploadingAvatar(true);
    try {
      const response = await fetch('/api/auth/avatar', { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setUser(prev => ({ ...prev, avatarUrl: null }));
      setAvatarKey(Date.now());
      showSuccess('Аватар удалён');
    } catch (err) {
      showError(err.message || 'Ошибка удаления');
    } finally {
      setUploadingAvatar(false);
      handleCloseUserMenu();
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'Сброс базы данных',
      message: 'Очистить всю базу данных? Это действие необратимо.',
      confirmLabel: 'Очистить',
      confirmColor: 'error',
    });
    if (!confirmed) return;
    await fetch('/api/debug/reset-db', { method: 'POST' });
    refreshAll();
    showSuccess('База данных очищена');
  };

  const testNotification = () => {
    if (!('Notification' in window)) {
      showWarning('Ваш браузер не поддерживает уведомления');
      return;
    }
    if (Notification.permission === 'granted') {
      new Notification('Уведомления работают!');
      showSuccess('Системное уведомление отправлено');
    } else if (Notification.permission === 'denied') {
      showWarning('Уведомления заблокированы в настройках браузера');
    } else {
      Notification.requestPermission();
      showInfo('Разрешите уведомления в запросе браузера');
    }
  };

  const handleSplit = (task) => {
    setSelectedTaskForSplit(task);
    setSplitModalOpen(true);
  };

  const handleSplitSuccess = () => refreshAll();
  const handleTabChange = (_event, newValue) => setActiveTab(newValue);
  const isAdmin = user?.role === 'Admin';

  const formatTime = (date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'Europe/Moscow'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      timeZone: 'Europe/Moscow'
    });
  };

  if (loading) return <LoadingState fullScreen />;
  if (!user) return <LoginForm onLogin={handleLogin} />;

  const avatarUrl = user?.avatarUrl && user?.id ? `/api/auth/avatar/${user.id}?t=${avatarKey}` : null;

  return (
    <>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 3 }}>
        <Container maxWidth="xl">
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Today color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h1" component="h1" sx={{ fontSize: '1.6rem', fontWeight: 600 }}>Mainstream Assistant</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2, bgcolor: '#f0f4f8', px: 2, py: 1, borderRadius: 3 }}>
                <Schedule sx={{ color: '#7c9ebf' }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {formatDate(currentTime)}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {formatTime(currentTime)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel id="admin-employee-label">Сотрудник</InputLabel>
                    <Select
                      labelId="admin-employee-label"
                      value={employee}
                      label="Сотрудник"
                      onChange={(e) => setEmployee(e.target.value)}
                    >
                      <MenuItem value="Дима">Дима</MenuItem>
                      <MenuItem value="Яромир">Яромир</MenuItem>
                      <MenuItem value="Павел">Павел</MenuItem>
                    </Select>
                  </FormControl>
                )}
                {isAdmin && <Divider orientation="vertical" flexItem sx={{ height: 30 }} />}
                {isAdmin && (
                  <Button variant="outlined" startIcon={<RestartAlt />} onClick={handleReset} color="error" size="medium">Сброс БД</Button>
                )}
                {isAdmin && (
                  <Button variant="outlined" startIcon={<Notifications />} onClick={testNotification} sx={{ color: '#7c9ebf', borderColor: '#7c9ebf' }} size="medium">Тест уведомлений</Button>
                )}
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar 
                    src={avatarUrl} 
                    sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}
                    onError={handleAvatarError}
                  >
                    {(!user?.avatarUrl) && (user?.fullName?.[0] || 'U')}
                  </Avatar>
                </IconButton>
              </Box>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ mb: 3, borderRadius: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange} centered>
              <Tab icon={<CalendarMonth />} label="Календарь" />
              <Tab icon={<TableChart />} label="Таблица задач" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <>
              <DeadlineWarnings employee={employee} refresh={refresh} />
              <WeekCalendar employee={employee} refresh={refresh} />
              <Box sx={{ mb: 4 }}>
                <ActiveTasksList tasks={activeTasks} onUpdate={refreshAll} onSplit={handleSplit} />
              </Box>
              <CompletedTasksList employee={employee} refresh={refresh} />
            </>
          )}

          {activeTab === 1 && (
            <TaskTable 
              refreshTrigger={refresh} 
              onTaskUpdate={refreshAll} 
              userRole={user?.role} 
              currentUser={user}
              selectedEmployeeForHighlight={employee}
            />
          )}

          {isAdmin && <DebugPanel employee={employee} onTimeChange={refreshAll} onRefresh={refreshAll} />}
          <SplitTaskModal open={splitModalOpen} task={selectedTaskForSplit} onClose={() => setSplitModalOpen(false)} onSuccess={handleSplitSuccess} />
        </Container>
      </Box>

      <Menu
        anchorEl={anchorElUser}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{user?.fullName}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            <Chip
              size="small"
              icon={isAdmin ? <AdminPanelSettings sx={{ fontSize: '0.85rem !important' }} /> : <Person sx={{ fontSize: '0.85rem !important' }} />}
              label={isAdmin ? 'Администратор' : 'Сотрудник'}
              sx={{ mt: 0.5, fontSize: '0.65rem', bgcolor: isAdmin ? '#fef3c7' : '#e0e7ff', color: isAdmin ? '#92400e' : '#3730a3', width: 'fit-content' }}
            />
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleFileSelect} disabled={uploadingAvatar}>
          <CloudUpload sx={{ mr: 1, fontSize: 20 }} /> Загрузить фото
        </MenuItem>
        {user?.avatarUrl && (
          <MenuItem onClick={handleDeleteAvatar} disabled={uploadingAvatar} sx={{ color: '#dc2626' }}>
            <Delete sx={{ mr: 1, fontSize: 20 }} /> Удалить фото
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: '#dc2626' }}>
          <Logout sx={{ mr: 1, fontSize: 20 }} /> Выйти
        </MenuItem>
      </Menu>

      <PushNotificationSnackbars
        notifications={notifications}
        onClose={closeNotification}
      />
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UiFeedbackProvider>
        <AppContent />
      </UiFeedbackProvider>
    </ThemeProvider>
  );
}

export default App;
