import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

export default function useTaskTableQuery(
  api,
  page,
  rowsPerPage,
  employeeFilter,
  excludeCompleted,
  search,
  showFuss = false,
  pickupMode = false
) {
  const filter = employeeFilter || '';
  const searchQuery = String(search ?? '').trim();

  return useQuery({
    queryKey: queryKeys.taskTable(page, rowsPerPage, filter, excludeCompleted, searchQuery, showFuss, pickupMode),
    queryFn: ({ signal }) =>
      api.loadRows(page + 1, rowsPerPage, filter, {
        signal,
        excludeCompleted,
        search: searchQuery,
        showFuss,
        pickupMode
      }),
    placeholderData: keepPreviousData,
    refetchInterval: false,
    refetchOnWindowFocus: true
  });
}
