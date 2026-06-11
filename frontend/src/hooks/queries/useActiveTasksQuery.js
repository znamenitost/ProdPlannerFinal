import { useQuery } from '@tanstack/react-query';
import { getActiveTasks } from '../../services/api';
import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';
import { queryKeys } from '../../lib/queryKeys';

export default function useActiveTasksQuery(employee, enabled = true) {
  return useQuery({
    queryKey: queryKeys.activeTasks(employee),
    queryFn: ({ signal }) => getActiveTasks(employee, { signal }),
    enabled: Boolean(enabled && employee),
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true
  });
}
