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
  CloudUpload,
  Delete
} from '@mui/icons-material';
import WeekCalendar from './components/WeekCalendar';
import ActiveTasksList from './components/ActiveTasksList';
import CompletedTasksList from './components/CompletedTasksList';
import DeadlineWarnings from './components/DeadlineWarnings';
import DebugPanel from './components/DebugPanel';
import SplitTaskModal from './components/SplitTaskModal';
import TaskTable from './components/TaskTable';
import LoginForm from './components/LoginForm';
import { getActiveTasks } from './services/api';

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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState('Дима');
  const [activeTasks, setActiveTasks] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);

  // Сбрасываем меню при смене пользователя
  useEffect(() => {
    setAnchorElUser(null);
  }, [user]);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        if (data.role !== 'Admin') setEmployee(data.fullName);
      }
    } catch (err) {
      console.error('Ошибка проверки авторизации:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.role !== 'Admin') setEmployee(userData.fullName);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setEmployee('Дима');
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

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
    if (!file.type.startsWith('image/')) return alert('Пожалуйста, выберите изображение');
    if (file.size > 2 * 1024 * 1024) return alert('Размер файла не должен превышать 2MB');

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/auth/upload-avatar', { method: 'POST', body: formData, credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setUser(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      alert('Аватар успешно загружен!');
    } catch (err) {
      alert(err.message || 'Ошибка загрузки');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Вы уверены, что хотите удалить аватар?')) return;
    setUploadingAvatar(true);
    try {
      const response = await fetch('/api/auth/avatar', { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setUser(prev => ({ ...prev, avatarUrl: null }));
      alert('Аватар удалён');
    } catch (err) {
      alert(err.message || 'Ошибка удаления');
    } finally {
      setUploadingAvatar(false);
      handleCloseUserMenu();
    }
  };

  useEffect(() => {
    if (user) {
      loadActiveTasks();
      const interval = setInterval(() => setRefresh(r => r + 1), 60000);
      return () => clearInterval(interval);
    }
  }, [employee, user]);

  const loadActiveTasks = async () => {
    try {
      const tasks = await getActiveTasks(employee);
      setActiveTasks(tasks);
    } catch (err) {
      console.error('Ошибка загрузки активных задач:', err);
    }
  };

  const refreshAll = () => {
    loadActiveTasks();
    setRefresh(r => r + 1);
  };

  const handleReset = async () => {
    if (window.confirm('Очистить всю базу данных?')) {
      await fetch('/api/debug/reset-db', { method: 'POST' });
      refreshAll();
    }
  };

  const testNotification = () => {
    if (!('Notification' in window)) return alert('Ваш браузер не поддерживает уведомления');
    if (Notification.permission === 'granted') {
      new Notification('✅ Уведомления работают!');
    } else if (Notification.permission === 'denied') {
      alert('Уведомления заблокированы.');
    } else {
      Notification.requestPermission();
    }
  };

  const handleSplit = (task) => {
    setSelectedTaskForSplit(task);
    setSplitModalOpen(true);
  };

  const handleSplitSuccess = () => refreshAll();
  const handleTabChange = (event, newValue) => setActiveTab(newValue);

  const isAdmin = user?.role === 'Admin';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Загрузка...</Typography>
      </Box>
    );
  }

  if (!user) return <LoginForm onLogin={handleLogin} />;

  const avatarUrl = user?.avatarUrl ? user.avatarUrl : null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 3 }}>
        <Container maxWidth="xl">
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Today color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h1" component="h1" sx={{ fontSize: '1.6rem', fontWeight: 600 }}>Mainstream Assistant</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel><Person sx={{ fontSize: 18 }} /> Сотрудник</InputLabel>
                    <Select value={employee} label="Сотрудник" onChange={(e) => setEmployee(e.target.value)}>
                      <MenuItem value="Дима">👤 Дима</MenuItem>
                      <MenuItem value="Яромир">👤 Яромир</MenuItem>
                      <MenuItem value="Павел">👤 Павел</MenuItem>
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
                  <Avatar src={avatarUrl} sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                    {!avatarUrl && (user?.fullName?.[0] || 'U')}
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
            <TaskTable refreshTrigger={refresh} onTaskUpdate={refreshAll} userRole={user?.role} currentUser={user} />
          )}

          <DebugPanel employee={employee} onTimeChange={refreshAll} onRefresh={refreshAll} />
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
            <Chip size="small" label={isAdmin ? '👑 Администратор' : '👤 Сотрудник'} sx={{ mt: 0.5, fontSize: '0.65rem', bgcolor: isAdmin ? '#fef3c7' : '#e0e7ff', color: isAdmin ? '#92400e' : '#3730a3', width: 'fit-content' }} />
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
    </ThemeProvider>
  );
}

export default App;