import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

export default function useTaskTableQuery(api, page, rowsPerPage, employeeFilter) {
  const filter = employeeFilter || '';

  return useQuery({
    queryKey: queryKeys.taskTable(page, rowsPerPage, filter),
    queryFn: ({ signal }) =>
      api.loadRows(page + 1, rowsPerPage, filter, { signal }),
    placeholderData: keepPreviousData
  });
}
