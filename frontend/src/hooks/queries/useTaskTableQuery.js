import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { PLANNED_TIME_PROGRESS_VISIBLE } from '../../components/taskTable/TaskPlannedProgressFooter';

// Прогресс-бар в таблице сейчас скрыт; polling включается только когда он снова нужен.
const ONE_MINUTE_MS = 60_000;

export default function useTaskTableQuery(api, page, rowsPerPage, employeeFilter) {
  const filter = employeeFilter || '';

  return useQuery({
    queryKey: queryKeys.taskTable(page, rowsPerPage, filter),
    queryFn: ({ signal }) =>
      api.loadRows(page + 1, rowsPerPage, filter, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: PLANNED_TIME_PROGRESS_VISIBLE ? ONE_MINUTE_MS : false,
    refetchOnWindowFocus: true
  });
}
