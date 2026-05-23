import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCompletedTasks } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

export default function useCompletedTasksQuery(employee, page, pageSize) {
  return useQuery({
    queryKey: queryKeys.completedTasks(employee, page, pageSize),
    queryFn: ({ signal }) =>
      getCompletedTasks(employee, page + 1, pageSize, { signal }),
    enabled: Boolean(employee),
    placeholderData: keepPreviousData
  });
}
