import { useQuery } from '@tanstack/react-query';
import { getDayPlan } from '../../services/api';
import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';
import { queryKeys } from '../../lib/queryKeys';

export default function useDayPlanQuery(employee, dateKey, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.dayPlan(employee, dateKey),
    queryFn: ({ signal }) => getDayPlan(employee, dateKey, { signal }),
    enabled: enabled && Boolean(employee && dateKey),
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true
  });
}
