import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useTaskTableQuery from '../queries/useTaskTableQuery';
import { queryKeys } from '../../lib/queryKeys';
import useAuth from '../useAuth';
import useUserPreference from '../useUserPreference';

export default function useTaskTableRows(api, {
  selectedEmployeeForHighlight,
  onCalendarRefresh,
  excludeCompleted = false
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useUserPreference(user, 'taskTable.page', 0);
  const [rowsPerPage, setRowsPerPage] = useUserPreference(user, 'taskTable.rowsPerPage', 50);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [highlightMyTasks, setHighlightMyTasks] = useUserPreference(user, 'taskTable.highlightMyTasks', false);

  const employeeFilter = selectedEmployeeForHighlight || '';
  const prevExcludeCompletedRef = useRef(excludeCompleted);

  const { data, refetch } = useTaskTableQuery(
    api,
    page,
    rowsPerPage,
    employeeFilter,
    excludeCompleted
  );

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    if (prevExcludeCompletedRef.current === excludeCompleted) return;
    prevExcludeCompletedRef.current = excludeCompleted;
    setPage(0);
  }, [excludeCompleted, setPage]);

  useEffect(() => {
    if (!excludeCompleted) return;
    const maxPage = Math.max(0, Math.ceil(totalCount / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [excludeCompleted, totalCount, rowsPerPage, page, setPage]);

  const refresh = useCallback(async () => {
    await refetch();
    onCalendarRefresh?.();
  }, [refetch, onCalendarRefresh]);

  const patchRow = useCallback(
    (id, patch) => {
      queryClient.setQueriesData({ queryKey: queryKeys.taskTableAll() }, (old) => {
        if (!old?.items?.some((row) => row.id === id)) return old;
        return {
          ...old,
          items: old.items.map((row) => (row.id === id ? { ...row, ...patch } : row))
        };
      });
    },
    [queryClient]
  );

  const removeRow = useCallback(
    (id) => {
      queryClient.setQueriesData({ queryKey: queryKeys.taskTableAll() }, (old) => {
        if (!old?.items?.some((row) => row.id === id)) return old;
        return {
          ...old,
          items: old.items.filter((row) => row.id !== id),
          totalCount: Math.max(0, (old.totalCount ?? 0) - 1)
        };
      });
    },
    [queryClient]
  );

  const toggleHighlight = useCallback(
    () => setHighlightMyTasks((prev) => !prev),
    [setHighlightMyTasks]
  );
  const handleChangePage = (_event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return {
    rows,
    totalCount,
    page,
    rowsPerPage,
    editingId,
    setEditingId,
    newRow,
    setNewRow,
    highlightMyTasks,
    toggleHighlight,
    handleChangePage,
    handleChangeRowsPerPage,
    refresh,
    patchRow,
    removeRow
  };
}
