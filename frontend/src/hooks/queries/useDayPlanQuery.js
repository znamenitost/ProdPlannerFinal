import { useQuery } from '@tanstack/react-query';
import { getDayPlan } from '../../services/api';
import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';
import { queryKeys } from '../../lib/queryKeys';

export default function useDayPlanQuery(employee, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.dayPlan(employee),
    queryFn: ({ signal }) => getDayPlan(employee, { signal }),
    enabled: enabled && Boolean(employee),
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true
  });
}
