import { useQuery } from '@tanstack/react-query';
import { getDeadlineRisks } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

export default function useDeadlineRisksQuery(employee) {
  return useQuery({
    queryKey: queryKeys.deadlineRisks(employee),
    queryFn: ({ signal }) => getDeadlineRisks(employee, { signal }),
    enabled: Boolean(employee),
    staleTime: 60_000
  });
}
