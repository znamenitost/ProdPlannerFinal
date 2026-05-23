import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';

/** Инвалидация кэша React Query вместо счётчика refresh. */
export default function useAppDataRefresh(employee) {
  const queryClient = useQueryClient();

  const refreshActiveTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.activeTasks(employee) });
  }, [queryClient, employee]);

  const refreshCalendar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.weekCalendarAll(employee) });
    queryClient.invalidateQueries({ queryKey: queryKeys.completedAll(employee) });
    queryClient.invalidateQueries({ queryKey: queryKeys.deadlineRisks(employee) });
    refreshActiveTasks();
  }, [queryClient, employee, refreshActiveTasks]);

  const refreshTable = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() });
  }, [queryClient]);

  const refreshAll = useCallback(() => {
    refreshCalendar();
    refreshTable();
  }, [refreshCalendar, refreshTable]);

  return {
    refreshActiveTasks,
    refreshCalendar,
    refreshTable,
    refreshAll
  };
}
