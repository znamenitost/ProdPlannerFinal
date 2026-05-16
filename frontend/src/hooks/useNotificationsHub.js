import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export default function useNotificationsHub(user, onRefresh) {
  const [notifications, setNotifications] = useState([]);
  const refreshTimeoutRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let isMounted = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub')
      .withAutomaticReconnect()
      .build();

    const refreshFromSignalR = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        if (isMounted) onRefreshRef.current?.();
      }, 300);
    };

    const handleNewTask = (taskId, taskTitle, deadline) => {
      if (!isMounted) return;
      const id = `${taskId}-${Date.now()}`;
      setNotifications(prev => [
        ...prev.slice(-19),
        {
          id,
          title: taskTitle,
          deadline: new Date(deadline).toLocaleString(),
        }
      ]);
      refreshFromSignalR();
    };

    const handleRefreshEvent = () => {
      refreshFromSignalR();
    };

    connection.on('NewTask', handleNewTask);
    connection.on('TaskDeleted', handleRefreshEvent);
    connection.on('TaskUpdated', handleRefreshEvent);
    connection.on('TaskStatusChanged', handleRefreshEvent);
    connection.on('TaskProgressChanged', handleRefreshEvent);

    connection.start()
      .then(() => {
        if (isMounted) {
          connection.invoke('JoinUserGroup', user.id).catch(err => console.error('JoinGroup error:', err));
        }
      })
      .catch(err => console.error('SignalR start error:', err));

    return () => {
      isMounted = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      connection.off('NewTask', handleNewTask);
      connection.off('TaskDeleted', handleRefreshEvent);
      connection.off('TaskUpdated', handleRefreshEvent);
      connection.off('TaskStatusChanged', handleRefreshEvent);
      connection.off('TaskProgressChanged', handleRefreshEvent);
      connection.stop().catch(err => console.error('SignalR stop error:', err));
    };
  }, [user?.id]);

  const closeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, closeNotification };
}
