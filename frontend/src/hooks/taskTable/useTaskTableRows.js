import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useTaskTableQuery from '../queries/useTaskTableQuery';
import { queryKeys } from '../../lib/queryKeys';

export default function useTaskTableRows(api, { selectedEmployeeForHighlight, onCalendarRefresh }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [highlightMyTasks, setHighlightMyTasks] = useState(false);

  const employeeFilter = selectedEmployeeForHighlight || '';

  const { data, refetch, dataUpdatedAt } = useTaskTableQuery(
    api,
    page,
    rowsPerPage,
    employeeFilter
  );

  const rows = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

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

  const toggleHighlight = () => setHighlightMyTasks((prev) => !prev);
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
    removeRow,
    tableDataUpdatedAt: dataUpdatedAt
  };
}
