import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

export default function useDailyReportQuery(employee, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dailyReport(employee),
    queryFn: ({ signal }) => getDailyReport(employee, { signal }),
    enabled: Boolean(employee) && enabled,
    staleTime: 30_000
  });
}
