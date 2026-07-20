import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  Typography,
  Container,
  Box,
  Paper,
  Autocomplete,
  TextField,
  Button,
  Chip,
  Tab,
  Tabs,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader
} from '@mui/material';
import {
  Today,
  SystemUpdateAlt,
  TableChart,
  CalendarMonth,
  Logout,
  Person,
  AdminPanelSettings,
  CloudUpload,
  Delete,
  Restaurant,
  TaskAlt,
  Download,
  Notifications,
  LinkOff,
} from '@mui/icons-material';
import CurrentDateTime from './components/CurrentDateTime';
import WeekCalendar from './components/WeekCalendar';
import DeadlineWarnings from './components/DeadlineWarnings';
import ActiveTasksList from './components/ActiveTasksList';
import CompletedTasksSection from './components/CompletedTasksSection';
import TaskTable from './components/TaskTable';
import LunchBreakOverlay from './components/LunchBreakOverlay';
import DeployMaintenanceOverlay from './components/DeployMaintenanceOverlay';
import PushNotificationSnackbars from './components/PushNotificationSnackbars';
import MaxLinkDialog from './components/MaxLinkDialog';
import ChatDrawer, { ChatHeaderButton } from './components/chat/ChatDrawer';
import FileOpenSettingsDialog from './components/FileOpenSettingsDialog';

const TaskTypeStatsDialog = lazy(() => import('./components/TaskTypeStatsDialog'));
import { ensureFileOpenSettingsLoaded } from './utils/fileOpenSettingsCache';
import useMaxMessenger from './hooks/useMaxMessenger';
import useChatUnread from './hooks/useChatUnread';
import useChatMessageToasts from './hooks/useChatMessageToasts';
import useWebPush from './hooks/useWebPush';
import { QueryClientProvider } from '@tanstack/react-query';
import { UiFeedbackProvider, useUiFeedback } from './context/UiFeedbackContext';
import { ClockProvider } from './context/ClockContext';
import { queryClient } from './lib/queryClient';
import useActiveTasksRefresh from './hooks/useActiveTasksRefresh';
import useAuth from './hooks/useAuth';
import useUserPreference from './hooks/useUserPreference';
import useNotificationsHub from './hooks/useNotificationsHub';
import useCdrPreviewRetryProcessor from './hooks/useCdrPreviewRetryProcessor';
import { endLunch, getCurrentLunch, prepareDeploy, startLunch } from './services/api';
import { avatarDisplayUrl } from './utils/avatarUrl';
import { detectClientPlatform } from './utils/filePathForOpen';
import { pageShellSx } from './theme/surfaces';
import { DEPLOY_PREPARE_ADMIN_FULL_NAME } from './constants/adminLoginAccounts';
import { MotionSwitch } from './components/ui/MotionSection';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ruRU } from '@mui/x-date-pickers/locales';
import 'dayjs/locale/ru';
import { DEPLOY_MAINTENANCE_EVENT } from './utils/deployMaintenance';
import './App.css';

function AuthenticatedAppContent() {
  const { user, setUser, employee, setEmployee, handleLogout } = useAuth();
  const { showSuccess, showError, showWarning, showLoading, hideSnackbar, confirm } = useUiFeedback();
  const [activeTab, setActiveTab] = useUserPreference(user, 'app.activeTab', 0);
  const [fileOpenSettingsOpen, setFileOpenSettingsOpen] = useState(false);
  const [taskTypeStatsOpen, setTaskTypeStatsOpen] = useState(false);
  const closeTaskTypeStats = useCallback(() => {
    hideSnackbar();
    setTaskTypeStatsOpen(false);
  }, [hideSnackbar]);
  const openTaskTypeStats = useCallback(() => {
    showLoading('Считаем статистику по типам задач…');
    setTaskTypeStatsOpen(true);
  }, [showLoading]);

  useEffect(() => {
    void ensureFileOpenSettingsLoaded();
  }, []);

  useEffect(() => {
    if (activeTab > 1) setActiveTab(0);
  }, [activeTab, setActiveTab]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lunchPending, setLunchPending] = useState(false);
  const [currentLunch, setCurrentLunch] = useState(null);
  const [deployMaintenanceActive, setDeployMaintenanceActive] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [maxLinkDialogOpen, setMaxLinkDialogOpen] = useState(false);
  const [maxLinkToken, setMaxLinkToken] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFocusConversationId, setChatFocusConversationId] = useState(null);
  const [chatActiveConversationId, setChatActiveConversationId] = useState(null);
  const [focusCommentTooltipTaskId, setFocusCommentTooltipTaskId] = useState(null);
  const fileInputRef = useRef(null);
  const maxMessenger = useMaxMessenger(user);
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

  const { processPending: processCdrPreviewRetries } = useCdrPreviewRetryProcessor({
    enabled: Boolean(user?.isAuthenticated),
    showWarning
  });
  const processCdrPreviewRetriesRef = useRef(processCdrPreviewRetries);
  processCdrPreviewRetriesRef.current = processCdrPreviewRetries;

  const handleHubFullRefresh = useCallback(() => {
    refreshAll();
    processCdrPreviewRetriesRef.current?.();
  }, [refreshAll]);

  const handleCdrPreviewRetryDue = useCallback(() => {
    processCdrPreviewRetriesRef.current?.();
  }, []);

  const handleHubTaskEvent = useCallback((event) => {
    if (!tableHubHandlerRef.current) return false;
    return tableHubHandlerRef.current(event);
  }, []);

  const handleHubTaskEventForTab = useCallback((event) => {
    if (activeTab !== 1) return false;
    return handleHubTaskEvent(event);
  }, [activeTab, handleHubTaskEvent]);

  const handleHubTableFallbackRefresh = useCallback(() => {
    if (activeTab === 1) refreshTable();
  }, [activeTab, refreshTable]);

  const prevActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab === 1 && prevActiveTabRef.current !== 1) {
      refreshTable();
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, refreshTable]);

  const handleHubActiveTasksRefresh = useCallback(() => {
    if (activeTab === 0) refreshActiveTasks();
  }, [activeTab, refreshActiveTasks]);

  const handleHubCalendarRefresh = useCallback(() => {
    if (activeTab === 0) refreshCalendar();
  }, [activeTab, refreshCalendar]);

  const handleHubLunchStateChanged = useCallback(({ employeeName, interval }) => {
    const lunchTarget = String(user?.fullName || employee || '').trim();
    if (employeeName !== lunchTarget) return;

    setCurrentLunch(interval?.endTime ? null : interval);

    if (activeTab === 0 && String(employee || '').trim() === employeeName) {
      refreshCalendar();
    }
  }, [user?.fullName, employee, activeTab, refreshCalendar]);

  const handleLabelPrintStatus = useCallback((payload) => {
    const status = String(payload?.status || payload?.Status || '');
    const code = String(payload?.pickupCode || payload?.PickupCode || '').trim();
    const title = String(payload?.orderTitle || payload?.OrderTitle || '').trim();
    const err = String(payload?.errorMessage || payload?.ErrorMessage || '').trim();
    const label = code ? `«${code}»` : (title ? `«${title}»` : '');

    if (status === 'Printing') {
      showSuccess(label ? `Идёт печать этикетки ${label}` : 'Идёт печать этикетки');
      return;
    }
    if (status === 'Printed') {
      showSuccess(label ? `Этикетка ${label} напечатана` : 'Этикетка напечатана');
      return;
    }
    if (status === 'Failed') {
      showError(err || (label ? `Не удалось напечатать этикетку ${label}` : 'Не удалось напечатать этикетку'));
    }
  }, [showSuccess, showError]);

  const viewSubscription = useMemo(
    () => ({
      activeTab,
      employee,
      userFullName: user?.fullName,
      isAdmin: user?.role === 'Admin'
    }),
    [activeTab, employee, user?.fullName, user?.role]
  );

  const notificationHandlers = useMemo(
    () => ({
      onTaskEvent: handleHubTaskEventForTab,
      onActiveTasksRefresh: handleHubActiveTasksRefresh,
      onTableFallbackRefresh: handleHubTableFallbackRefresh,
      onCalendarRefresh: handleHubCalendarRefresh,
      onFullRefresh: handleHubFullRefresh,
      onCdrPreviewRetryDue: handleCdrPreviewRetryDue,
      onLunchStateChanged: handleHubLunchStateChanged,
      onLabelPrintStatus: handleLabelPrintStatus
    }),
    [
      handleHubTaskEventForTab,
      handleHubActiveTasksRefresh,
      handleHubTableFallbackRefresh,
      handleHubCalendarRefresh,
      handleHubFullRefresh,
      handleCdrPreviewRetryDue,
      handleHubLunchStateChanged,
      handleLabelPrintStatus
    ]
  );

  const handleDeployMaintenanceDetected = useCallback(() => {
    setDeployMaintenanceActive(true);
  }, []);

  useEffect(() => {
    window.addEventListener(DEPLOY_MAINTENANCE_EVENT, handleDeployMaintenanceDetected);
    return () => window.removeEventListener(DEPLOY_MAINTENANCE_EVENT, handleDeployMaintenanceDetected);
  }, [handleDeployMaintenanceDetected]);

  const { notifications, closeNotification, hubConnection } = useNotificationsHub(user, notificationHandlers, {
    enabled: Boolean(user?.isAuthenticated) && !deployMaintenanceActive,
    viewSubscription,
    onMaintenanceDetected: handleDeployMaintenanceDetected
  });

  const { unreadCount, refreshUnread } = useChatUnread(user, hubConnection, {
    enabled: Boolean(user?.isAuthenticated) && !deployMaintenanceActive
  });

  const { chatToasts, closeChatToast } = useChatMessageToasts(user, hubConnection, {
    enabled: Boolean(user?.isAuthenticated) && !deployMaintenanceActive,
    chatOpen,
    activeConversationId: chatActiveConversationId
  });

  useWebPush(user, {
    enabled: Boolean(user?.isAuthenticated) && !deployMaintenanceActive
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get('chat');
    if (!chatId) return;
    setChatFocusConversationId(String(chatId));
    setChatOpen(true);
    params.delete('chat');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }, []);

  const allPushNotifications = useMemo(
    () => [...notifications, ...chatToasts],
    [notifications, chatToasts]
  );

  const handleClosePushNotification = useCallback((id) => {
    if (String(id).startsWith('chat-')) closeChatToast(id);
    else closeNotification(id);
  }, [closeChatToast, closeNotification]);

  const handleOpenChatFromToast = useCallback((notification) => {
    if (notification?.conversationId) {
      setChatFocusConversationId(String(notification.conversationId));
    }
    closeChatToast(notification.id);
    setChatOpen(true);
  }, [closeChatToast]);

  const handleOpenFromPush = useCallback((notification) => {
    if (notification?.type === 'ChatMessage') {
      handleOpenChatFromToast(notification);
      return;
    }
    if (notification?.type === 'TaskCommentAdded' && notification.taskId != null) {
      closeNotification(notification.id);
      setActiveTab(1);
      setFocusCommentTooltipTaskId(Number(notification.taskId));
    }
  }, [closeNotification, handleOpenChatFromToast, setActiveTab]);

  const handleOpenChat = useCallback(() => {
    setChatFocusConversationId(null);
    setChatOpen(true);
  }, []);

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    setChatFocusConversationId(null);
    setChatActiveConversationId(null);
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => { setAnchorElUser(null); }, [user]);

  const targetLunchEmployee = user?.fullName || employee || '';

  useEffect(() => {
    let cancelled = false;
    if (!user?.isAuthenticated || !targetLunchEmployee) {
      setCurrentLunch(null);
      return undefined;
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
  }, [targetLunchEmployee, user?.isAuthenticated, user?.id]);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleFileSelect = () => {
    handleCloseUserMenu();
    requestAnimationFrame(() => {
      fileInputRef.current?.click();
    });
  };

  const handleDownloadFileOpener = () => {
    handleCloseUserMenu();
    window.location.href = '/api/files/download/windows-agent';
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.svg$/i.test(file.name)) {
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
      if (!response.ok) throw new Error(data.message || data.error || 'Ошибка загрузки');

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
      event.target.value = '';
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

  const handleMaxLink = async () => {
    if (!maxMessenger.linkStatus.botConfigured) {
      showWarning('MAX-бот не настроен на сервере (MaxBot:AccessToken).');
      return;
    }
    handleCloseUserMenu();
    setMaxLinkDialogOpen(true);
    setMaxLinkToken(null);
    try {
      const token = await maxMessenger.requestLinkToken();
      setMaxLinkToken(token);
    } catch (err) {
      setMaxLinkDialogOpen(false);
      showError(err.message || 'Не удалось получить код привязки');
    }
  };

  const handleMaxUnlink = async () => {
    handleCloseUserMenu();
    try {
      await maxMessenger.unlink();
      showSuccess('MAX отвязан');
    } catch (err) {
      showError(err.message || 'Не удалось отвязать MAX');
    }
  };

  const handleMaxSubscribeToggle = async (taskId, nextSubscribed) => {
    try {
      await maxMessenger.toggleTaskSubscription(taskId, nextSubscribed);
    } catch (err) {
      showError(err.message || 'Не удалось изменить подписку MAX');
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

  const handleEnterDeploy = async () => {
    const confirmed = await confirm({
      title: 'Уйти в деплой',
      message: 'Приложение остановится для обновления. Все пользователи увидят экран «Приложение обновляется». После деплоя сайт запустится автоматически.',
      confirmLabel: 'Уйти в деплой',
      confirmColor: 'warning',
    });
    if (!confirmed) return;

    setDeployMaintenanceActive(true);
    try {
      await prepareDeploy();
    } catch (err) {
      setDeployMaintenanceActive(false);
      showError(err.message || 'Не удалось включить режим обновления');
    }
  };

  useEffect(() => {
    if (!deployMaintenanceActive) return undefined;

    const pollForRestart = () => {
      fetch('/', { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => response.text())
        .then((html) => {
          if (html.includes('id="root"')) {
            window.location.reload();
          }
        })
        .catch(() => {});
    };

    const timer = window.setInterval(pollForRestart, 5000);
    pollForRestart();
    return () => window.clearInterval(timer);
  }, [deployMaintenanceActive]);

  const handleTabChange = (_event, newValue) => setActiveTab(newValue);
  const isAdmin = user?.role === 'Admin';
  const canPrepareDeploy = isAdmin && user?.fullName === DEPLOY_PREPARE_ADMIN_FULL_NAME;
  const isWindowsClient = detectClientPlatform() === 'Win32';
  const isOnLunchBreak = Boolean(currentLunch);
  const avatarUrl = user?.avatarUrl && user?.id
    ? avatarDisplayUrl(user.id, { size: 128, cacheBust: avatarKey })
    : null;

  return (
    <>
      <Box sx={pageShellSx}>
        <Container maxWidth="xl">
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: { md: 1 } }}>
                <Box
                  component="img"
                  src="/sprites/logo.svg"
                  alt="Production Planner"
                  sx={{
                    height: 36,
                    width: 'auto',
                    maxWidth: { xs: 220, sm: 280 },
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
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
                <ChatHeaderButton
                  unreadCount={unreadCount}
                  onClick={handleOpenChat}
                />
                {canPrepareDeploy && (
                  <Button
                    variant="outlined"
                    startIcon={<SystemUpdateAlt />}
                    onClick={handleEnterDeploy}
                    color="warning"
                    size="medium"
                    disabled={deployMaintenanceActive}
                  >
                    Уйти в деплой
                  </Button>
                )}
                <IconButton onClick={handleOpenUserMenu} aria-label="Меню пользователя" sx={{ p: 0 }}>
                  <Avatar
                    key={avatarKey}
                    src={avatarUrl}
                    slotProps={{
                      img: { loading: 'lazy', decoding: 'async', fetchpriority: 'low' },
                    }}
                    sx={{ width: 56, height: 56, fontSize: '1.25rem', bgcolor: 'primary.main' }}
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
            {activeTab === 0 && (
              <>
                <WeekCalendar employee={employee} />
                {!isAdmin && <DeadlineWarnings employee={employee} />}
                <ActiveTasksList
                  sectionTitle="Активные задачи"
                  sectionIcon={<Today color="primary" />}
                  sectionSx={{ mb: 3 }}
                  onUpdate={refreshCalendar}
                  onStatisticsRecalculated={refreshAll}
                  employee={employee}
                  isAdmin={isAdmin}
                />
                <CompletedTasksSection employee={employee} />
              </>
            )}
            {activeTab === 1 && (
              <TaskTable
                onCalendarRefresh={refreshCalendar}
                onRegisterHubHandler={registerTableHubHandler}
                userRole={user?.role}
                currentUser={user}
                selectedEmployeeForHighlight={employee}
                maxSubscribedTaskIds={maxMessenger.subscribedTaskIds}
                maxCanSubscribe={maxMessenger.canSubscribe}
                onMaxSubscribeToggle={handleMaxSubscribeToggle}
                focusCommentTooltipTaskId={focusCommentTooltipTaskId}
                onFocusCommentTooltipConsumed={() => setFocusCommentTooltipTaskId(null)}
                onOpenFileOpenSettings={isAdmin ? () => setFileOpenSettingsOpen(true) : undefined}
                onOpenTaskTypeStats={isAdmin ? openTaskTypeStats : undefined}
                taskTypeStatsOpen={taskTypeStatsOpen}
              />
            )}
          </MotionSwitch>
        </Container>
      </Box>

      <Menu
        anchorEl={anchorElUser}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <ListSubheader disableSticky sx={{ lineHeight: 1.4, py: 1.5, bgcolor: 'transparent' }}>
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
        </ListSubheader>
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
        {isWindowsClient && (
          <MenuItem onClick={handleDownloadFileOpener}>
            <ListItemIcon><Download fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText
              primary="Скачать агент"
              secondary="Открытие файлов и превью .cdr в веб-приложении"
            />
          </MenuItem>
        )}
        {isWindowsClient && <Divider />}
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
        {maxMessenger.linkStatus.botConfigured && (
          <>
            <Divider />
            {maxMessenger.linkStatus.linked ? (
              <MenuItem onClick={handleMaxUnlink}>
                <ListItemIcon><LinkOff fontSize="small" color="primary" /></ListItemIcon>
                <ListItemText
                  primary="Отвязать MAX"
                  secondary="Уведомления о подписках на задачи"
                />
              </MenuItem>
            ) : (
              <MenuItem onClick={handleMaxLink}>
                <ListItemIcon><Notifications fontSize="small" color="primary" /></ListItemIcon>
                <ListItemText
                  primary="Привязать MAX"
                  secondary="Получать статус задач в мессенджере"
                />
              </MenuItem>
            )}
          </>
        )}
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Выйти</ListItemText>
        </MenuItem>
      </Menu>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,.svg"
        onChange={handleAvatarUpload}
      />

      {deployMaintenanceActive && <DeployMaintenanceOverlay />}

      {isOnLunchBreak && !deployMaintenanceActive && (
        <LunchBreakOverlay
          user={user}
          avatarUrl={avatarUrl}
          onAvatarError={handleAvatarError}
          onSwitchUser={handleLogout}
          onEndLunch={handleEndLunch}
          lunchPending={lunchPending}
        />
      )}

      <MaxLinkDialog
        open={maxLinkDialogOpen}
        token={maxLinkToken}
        onClose={() => {
          setMaxLinkDialogOpen(false);
          void maxMessenger.refresh();
        }}
      />

      <FileOpenSettingsDialog
        open={fileOpenSettingsOpen}
        onClose={() => setFileOpenSettingsOpen(false)}
      />

      {isAdmin && taskTypeStatsOpen && (
        <Suspense fallback={null}>
          <TaskTypeStatsDialog
            open={taskTypeStatsOpen}
            onClose={closeTaskTypeStats}
          />
        </Suspense>
      )}

      <ChatDrawer
        open={chatOpen}
        onClose={handleCloseChat}
        user={user}
        hubConnection={hubConnection}
        onUnreadMaybeChanged={refreshUnread}
        initialConversationId={chatFocusConversationId}
        onActiveConversationChange={setChatActiveConversationId}
      />

      <PushNotificationSnackbars
        notifications={allPushNotifications}
        onClose={handleClosePushNotification}
        onOpen={handleOpenFromPush}
      />
    </>
  );
}

export default function AuthenticatedApp() {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="ru"
      localeText={ruRU.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <QueryClientProvider client={queryClient}>
        <UiFeedbackProvider>
          <ClockProvider>
            <AuthenticatedAppContent />
          </ClockProvider>
        </UiFeedbackProvider>
      </QueryClientProvider>
    </LocalizationProvider>
  );
}
