import { useQuery } from '@tanstack/react-query';
import { getDeadlineRisks } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

// Уровень риска (warning/critical/overdue) считается относительно текущего времени —
// пересчитываем каждую минуту, чтобы алармы появлялись вовремя.
const ONE_MINUTE_MS = 60_000;

export default function useDeadlineRisksQuery(employee) {
  return useQuery({
    queryKey: queryKeys.deadlineRisks(employee),
    queryFn: ({ signal }) => getDeadlineRisks(employee, { signal }),
    enabled: Boolean(employee),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
    refetchOnWindowFocus: true
  });
}
