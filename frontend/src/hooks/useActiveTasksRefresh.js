import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveTasks } from '../services/api';

export default function useActiveTasksRefresh(user, employee) {
  const [activeTasks, setActiveTasks] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const retryTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadActiveTasks = useCallback(async (signal) => {
    try {
      const tasks = await getActiveTasks(employee, { signal });
      if (mountedRef.current) setActiveTasks(tasks);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Ошибка загрузки активных задач:', err);
      }
    }
  }, [employee]);

  useEffect(() => {
    if (!user) {
      setActiveTasks([]);
      return undefined;
    }

    const controller = new AbortController();
    loadActiveTasks(controller.signal);
    const interval = setInterval(() => setRefresh(r => r + 1), 60000);

    return () => {
      controller.abort();
      clearInterval(interval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [loadActiveTasks, user]);

  const refreshAll = useCallback(() => {
    loadActiveTasks();
    setRefresh(r => r + 1);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    retryTimeoutRef.current = setTimeout(() => {
      loadActiveTasks();
      setRefresh(r => r + 1);
      retryTimeoutRef.current = null;
    }, 200);
  }, [loadActiveTasks]);

  return { activeTasks, refresh, refreshAll };
}
