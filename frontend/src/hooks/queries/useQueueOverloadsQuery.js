import { useQuery } from '@tanstack/react-query';
import { getQueueOverloads } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';

export default function useQueueOverloadsQuery(employee) {
  return useQuery({
    queryKey: queryKeys.queueOverloads(employee),
    queryFn: ({ signal }) => getQueueOverloads(employee, { signal }),
    enabled: Boolean(employee),
    staleTime: FIVE_MINUTES_MS,
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true
  });
}
