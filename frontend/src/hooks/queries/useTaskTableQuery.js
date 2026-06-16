import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

export default function useTaskTableQuery(api, page, rowsPerPage, employeeFilter, excludeCompleted) {
  const filter = employeeFilter || '';

  return useQuery({
    queryKey: queryKeys.taskTable(page, rowsPerPage, filter, excludeCompleted),
    queryFn: ({ signal }) =>
      api.loadRows(page + 1, rowsPerPage, filter, { signal, excludeCompleted }),
    placeholderData: keepPreviousData,
    refetchInterval: false,
    refetchOnWindowFocus: true
  });
}
