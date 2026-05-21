import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveTasks } from '../services/api';

export default function useActiveTasksRefresh(user, employee) {
  const [activeTasks, setActiveTasks] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const mountedRef = useRef(true);
  const fetchSeqRef = useRef(0);
  const activeAbortRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeAbortRef.current?.abort();
    };
  }, []);

  const loadActiveTasks = useCallback(async () => {
    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;
    const seq = ++fetchSeqRef.current;

    try {
      const tasks = await getActiveTasks(employee, { signal: controller.signal });
      if (seq === fetchSeqRef.current && mountedRef.current) {
        setActiveTasks(tasks);
      }
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
    loadActiveTasks();
  }, [loadActiveTasks, user]);

  const bumpCalendarRefresh = useCallback(() => {
    setRefresh((r) => r + 1);
  }, []);

  const refreshActiveTasks = useCallback(() => {
    loadActiveTasks();
  }, [loadActiveTasks]);

  /** Календарь + выполненные (счётчик refresh) и активные карточки */
  const refreshCalendar = useCallback(() => {
    bumpCalendarRefresh();
    loadActiveTasks();
  }, [bumpCalendarRefresh, loadActiveTasks]);

  /** Полное обновление вкладки «Календарь» (без двойного fetch) */
  const refreshAll = refreshCalendar;

  return {
    activeTasks,
    refresh,
    refreshActiveTasks,
    refreshCalendar,
    refreshAll
  };
}
