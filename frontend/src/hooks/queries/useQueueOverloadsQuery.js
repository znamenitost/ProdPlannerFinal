import { useQuery } from '@tanstack/react-query';
import { getQueueOverloads } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

const ONE_MINUTE_MS = 60_000;

export default function useQueueOverloadsQuery(employee) {
  return useQuery({
    queryKey: queryKeys.queueOverloads(employee),
    queryFn: ({ signal }) => getQueueOverloads(employee, { signal }),
    enabled: Boolean(employee),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
    refetchOnWindowFocus: true
  });
}
