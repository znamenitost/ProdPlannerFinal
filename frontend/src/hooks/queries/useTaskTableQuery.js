import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

// В таблице у активных задач крутится локальный прогресс-бар «по выделенным часам»,
// который рассчитывается на бэке. Чтобы он сам ехал, минутно обновляем строки.
const ONE_MINUTE_MS = 60_000;

export default function useTaskTableQuery(api, page, rowsPerPage, employeeFilter) {
  const filter = employeeFilter || '';

  return useQuery({
    queryKey: queryKeys.taskTable(page, rowsPerPage, filter),
    queryFn: ({ signal }) =>
      api.loadRows(page + 1, rowsPerPage, filter, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: ONE_MINUTE_MS,
    refetchOnWindowFocus: true
  });
}
