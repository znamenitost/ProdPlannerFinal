import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  CssBaseline,
  Chip,
  Tab,
  Tabs,
  Avatar,
  Menu,
  IconButton,
  Divider,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  Today, 
  RestartAlt, 
  TableChart, 
  CalendarMonth, 
  Logout, 
  Person,
  AdminPanelSettings,
  CloudUpload,
  Delete,
} from '@mui/icons-material';
import CurrentDateTime from './components/CurrentDateTime';
import WeekCalendar from './components/WeekCalendar';
import ActiveTasksList from './components/ActiveTasksList';
import CompletedTasksList from './components/CompletedTasksList';
import DebugPanel from './components/DebugPanel';
import TaskTable from './components/TaskTable';
import LoginForm from './components/LoginForm';
import PushNotificationSnackbars from './components/PushNotificationSnackbars';
import { LoadingState } from './components/LoadingState';
import { QueryClientProvider } from '@tanstack/react-query';
import { UiFeedbackProvider, useUiFeedback } from './context/UiFeedbackContext';
import { ClockProvider } from './context/ClockContext';
import { queryClient } from './lib/queryClient';
import useActiveTasksRefresh from './hooks/useActiveTasksRefresh';
import useAuth from './hooks/useAuth';
import useNotificationsHub from './hooks/useNotificationsHub';
import appTheme from './theme/appTheme';
import { glassPaperSx, pageShellSx } from './theme/surfaces';
import SectionCard from './components/ui/SectionCard';
import { MotionSwitch } from './components/ui/MotionSection';

function AppContent() {
  const { user, setUser, loading, employee, setEmployee, handleLogin, handleLogout } = useAuth();
  const { showSuccess, showError, showWarning, showInfo, confirm } = useUiFeedback();
  const [activeTab, setActiveTab] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const {
    refreshActiveTasks,
    refreshCalendar,
    refreshTable,
    refreshAll
  } = useActiveTasksRefresh(user, employee);

  const tableHubHandlerRef = useRef(null);
  const registerTableHubHandler = useCallback((handler) => {
    tableHubHandlerRef.current = handler;
  }, []);

  const handleHubTaskEvent = useCallback(
    (event) => {
      if (activeTab !== 1 || !tableHubHandlerRef.current) {
        return false;
      }
      return tableHubHandlerRef.current(event);
    },
    [activeTab]
  );

  const handleHubTableFallbackRefresh = useCallback(() => {
    if (activeTab === 1) {
      refreshTable();
    }
  }, [activeTab, refreshTable]);

  const handleHubCalendarRefresh = useCallback(() => {
    if (activeTab !== 1) {
      refreshCalendar();
    }
  }, [activeTab, refreshCalendar]);

  const notificationHandlers = useMemo(
    () => ({
      onTaskEvent: handleHubTaskEvent,
      onActiveTasksRefresh: refreshActiveTasks,
      onTableFallbackRefresh: handleHubTableFallbackRefresh,
      onCalendarRefresh: handleHubCalendarRefresh,
      onFullRefresh: refreshAll
    }),
    [handleHubTaskEvent, refreshActiveTasks, handleHubTableFallbackRefresh, handleHubCalendarRefresh, refreshAll]
  );

  const { notifications, closeNotification } = useNotificationsHub(user, notificationHandlers);

  useEffect(() => { setAnchorElUser(null); }, [user]);

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
    try {
      const response = await fetch('/api/debug/reset-db', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      refreshAll();
      showSuccess('База данных очищена');
    } catch (err) {
      showError(err.message || 'Не удалось сбросить базу данных');
    }
  };

  const handleTabChange = (_event, newValue) => setActiveTab(newValue);
  const isAdmin = user?.role === 'Admin';

  if (loading) return <LoadingState fullScreen />;
  if (!user) return <LoginForm onLogin={handleLogin} />;

  const avatarUrl = user?.avatarUrl && user?.id ? `/api/auth/avatar/${user.id}?t=${avatarKey}` : null;

  return (
    <>
      <Box sx={pageShellSx}>
        <Container maxWidth="xl">
          <Paper sx={{ ...glassPaperSx, p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Today color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="h1" component="h1">Mainstream Assistant</Typography>
              </Box>
              
              <CurrentDateTime />

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

          <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
            <Tabs value={activeTab} onChange={handleTabChange} centered variant="fullWidth">
              <Tab icon={<CalendarMonth />} iconPosition="start" label="Календарь" />
              <Tab icon={<TableChart />} iconPosition="start" label="Таблица задач" />
            </Tabs>
          </Paper>

          <MotionSwitch transitionKey={activeTab}>
            {activeTab === 0 ? (
              <>
                <WeekCalendar employee={employee} />
                <SectionCard title="Активные задачи" icon={<Today color="primary" />} sx={{ mb: 3 }} disablePadding>
                  <ActiveTasksList onUpdate={refreshCalendar} embedded employee={employee} />
                </SectionCard>
                <CompletedTasksList employee={employee} />
              </>
            ) : (
              <TaskTable
                onCalendarRefresh={refreshCalendar}
                onRegisterHubHandler={registerTableHubHandler}
                userRole={user?.role}
                currentUser={user}
                selectedEmployeeForHighlight={employee}
              />
            )}
          </MotionSwitch>

          {isAdmin && (
            <DebugPanel employee={employee} onTimeChange={refreshAll} onRefresh={refreshAll} />
          )}
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
              color={isAdmin ? 'warning' : 'info'}
              variant="outlined"
              icon={isAdmin ? <AdminPanelSettings sx={{ fontSize: '0.85rem !important' }} /> : <Person sx={{ fontSize: '0.85rem !important' }} />}
              label={isAdmin ? 'Администратор' : 'Сотрудник'}
              sx={{ mt: 0.5, fontSize: '0.65rem', width: 'fit-content' }}
            />
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleFileSelect} disabled={uploadingAvatar}>
          <ListItemIcon><CloudUpload fontSize="small" /></ListItemIcon>
          <ListItemText>Загрузить фото</ListItemText>
        </MenuItem>
        {user?.avatarUrl && (
          <MenuItem onClick={handleDeleteAvatar} disabled={uploadingAvatar} sx={{ color: 'error.main' }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Удалить фото</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Выйти</ListItemText>
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
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <UiFeedbackProvider>
          <ClockProvider>
            <AppContent />
          </ClockProvider>
        </UiFeedbackProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
