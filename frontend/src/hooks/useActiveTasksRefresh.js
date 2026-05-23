import useActiveTasksQuery from './queries/useActiveTasksQuery';
import useAppDataRefresh from './useAppDataRefresh';

export default function useActiveTasksRefresh(user, employee) {
  const refresh = useAppDataRefresh(employee);

  return {
    ...refresh
  };
}

export { useActiveTasksQuery };
