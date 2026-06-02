import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Typography,
  Container,
  Box,
  Paper,
  Autocomplete,
  TextField,
  Button,
  ThemeProvider,
  CssBaseline,
  Chip,
  Tab,
  Tabs,
  Avatar,
  Menu,
  MenuItem,
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
  Restaurant,
  TaskAlt,
} from '@mui/icons-material';
import CurrentDateTime from './components/CurrentDateTime';
import WeekCalendar from './components/WeekCalendar';
import DeadlineWarnings from './components/DeadlineWarnings';
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
import { endLunch, getCurrentLunch, startLunch } from './services/api';
import appTheme from './theme/appTheme';
import { pageShellSx } from './theme/surfaces';
import SectionCard from './components/ui/SectionCard';
import { MotionSwitch } from './components/ui/MotionSection';

function AppContent() {
  const { user, setUser, loading, employee, setEmployee, handleLogin, handleLogout } = useAuth();
  const { showSuccess, showError, showWarning, showInfo, confirm, promptInput } = useUiFeedback();
  const [activeTab, setActiveTab] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lunchPending, setLunchPending] = useState(false);
  const [currentLunch, setCurrentLunch] = useState(null);
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

  const handleHubTaskEvent = useCallback((event) => {
    if (!tableHubHandlerRef.current) return false;
    return tableHubHandlerRef.current(event);
  }, []);

  const handleHubTableFallbackRefresh = useCallback(
    (event) => {
      const instantTableSync =
        event?.type === 'TaskStatusChanged' || event?.type === 'TaskProgressChanged';
      if (instantTableSync || activeTab === 1) {
        refreshTable();
      }
    },
    [activeTab, refreshTable]
  );

  const shouldRefreshSelectedEmployee = useCallback((event) => {
    const affectedEmployees = event?.affectedEmployees;
    if (!Array.isArray(affectedEmployees)) return true;
    if (!employee) return false;
    return affectedEmployees.includes(employee);
  }, [employee]);

  const handleHubActiveTasksRefresh = useCallback((event) => {
    if (shouldRefreshSelectedEmployee(event)) {
      refreshActiveTasks();
    }
  }, [refreshActiveTasks, shouldRefreshSelectedEmployee]);

  const handleHubCalendarRefresh = useCallback((event) => {
    if (shouldRefreshSelectedEmployee(event)) {
      refreshCalendar();
    }
  }, [refreshCalendar, shouldRefreshSelectedEmployee]);

  const notificationHandlers = useMemo(
    () => ({
      onTaskEvent: handleHubTaskEvent,
      onActiveTasksRefresh: handleHubActiveTasksRefresh,
      onTableFallbackRefresh: handleHubTableFallbackRefresh,
      onCalendarRefresh: handleHubCalendarRefresh,
      onFullRefresh: refreshAll
    }),
    [handleHubTaskEvent, handleHubActiveTasksRefresh, handleHubTableFallbackRefresh, handleHubCalendarRefresh, refreshAll]
  );

  const { notifications, closeNotification } = useNotificationsHub(user, notificationHandlers);

  useEffect(() => { setAnchorElUser(null); }, [user]);

  const targetLunchEmployee = employee || user?.fullName || '';

  useEffect(() => {
    let cancelled = false;
    if (!targetLunchEmployee) {
      setCurrentLunch(null);
      return;
    }

    getCurrentLunch(targetLunchEmployee)
      .then((interval) => {
        if (!cancelled) setCurrentLunch(interval);
      })
      .catch(() => {
        if (!cancelled) setCurrentLunch(null);
      });

    return () => {
      cancelled = true;
    };
  }, [targetLunchEmployee]);

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

  const handleStartLunch = async () => {
    if (!targetLunchEmployee || lunchPending) return;
    handleCloseUserMenu();
    setLunchPending(true);
    try {
      const interval = await startLunch(targetLunchEmployee);
      setCurrentLunch(interval);
      refreshAll();
      showSuccess('Обед начат');
    } catch (err) {
      showError(err.message || 'Не удалось начать обед');
    } finally {
      setLunchPending(false);
    }
  };

  const handleEndLunch = async () => {
    if (!targetLunchEmployee || lunchPending) return;
    handleCloseUserMenu();
    setLunchPending(true);
    try {
      await endLunch(targetLunchEmployee);
      setCurrentLunch(null);
      refreshAll();
      showSuccess('Обед завершён');
    } catch (err) {
      showError(err.message || 'Не удалось завершить обед');
    } finally {
      setLunchPending(false);
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

    const password = await promptInput({
      title: 'Пароль сброса базы данных',
      message: 'Введите пароль администратора для необратимого сброса базы.',
      inputLabel: 'Пароль',
      inputType: 'password',
      inputRequired: true,
      confirmLabel: 'Сбросить базу',
      confirmColor: 'error',
    });
    if (!password) return;

    const resetPassword = password.trim();
    try {
      const response = await fetch('/api/debug/reset-db', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Reset-Db-Password': resetPassword,
        },
        body: JSON.stringify({ password: resetPassword }),
      });
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
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Today color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="h1" component="h1">Mainstream Assistant</Typography>
              </Box>
              
              <CurrentDateTime />

              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <Autocomplete
                    size="small"
                    disableClearable
                    options={['Дима', 'Яромир', 'Павел']}
                    value={employee}
                    onChange={(_e, value) => {
                      if (value) setEmployee(value);
                    }}
                    sx={{ minWidth: 160 }}
                    renderInput={(params) => <TextField {...params} label="Сотрудник" />}
                  />
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

          <Paper sx={{ mb: 3, borderRadius: 2.5, overflow: 'hidden' }}>
            <Tabs value={activeTab} onChange={handleTabChange} centered variant="fullWidth">
              <Tab icon={<CalendarMonth />} iconPosition="start" label="Календарь" />
              <Tab icon={<TableChart />} iconPosition="start" label="Таблица задач" />
            </Tabs>
          </Paper>

          <MotionSwitch transitionKey={activeTab}>
            {activeTab === 0 ? (
              <>
                <WeekCalendar employee={employee} />
                {!isAdmin && <DeadlineWarnings employee={employee} />}
                <SectionCard title="Активные задачи" icon={<Today color="primary" />} sx={{ mb: 3 }} disablePadding>
                  <ActiveTasksList
                    onUpdate={refreshCalendar}
                    onStatisticsRecalculated={refreshAll}
                    embedded
                    employee={employee}
                    isAdmin={isAdmin}
                  />
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
        {currentLunch ? (
          <MenuItem onClick={handleEndLunch} disabled={lunchPending || !targetLunchEmployee}>
            <ListItemIcon><TaskAlt fontSize="small" color="success" /></ListItemIcon>
            <ListItemText>Пообедал</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleStartLunch} disabled={lunchPending || !targetLunchEmployee}>
            <ListItemIcon><Restaurant fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>Обед</ListItemText>
          </MenuItem>
        )}
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
