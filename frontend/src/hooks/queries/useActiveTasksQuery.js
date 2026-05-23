import { useQuery } from '@tanstack/react-query';
import { getActiveTasks } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

export default function useActiveTasksQuery(employee, enabled = true) {
  return useQuery({
    queryKey: queryKeys.activeTasks(employee),
    queryFn: ({ signal }) => getActiveTasks(employee, { signal }),
    enabled: Boolean(enabled && employee)
  });
}
