const EXTRA_FREE_SLOTS = 3;

export function getOccupiedPriorityRanks(queue = []) {
  return (Array.isArray(queue) ? queue : [])
    .map((item) => Number(item?.rank))
    .filter((rank) => Number.isInteger(rank) && rank > 0);
}

export function getVisiblePriorityRanks(queue = [], currentRank = null) {
  const occupied = getOccupiedPriorityRanks(queue);
  const maxOccupied = occupied.length ? Math.max(...occupied) : 0;
  const current = Number(currentRank) > 0 ? Number(currentRank) : 0;
  const last = Math.max(maxOccupied, current, 0) + EXTRA_FREE_SLOTS;
  const length = Math.max(last, EXTRA_FREE_SLOTS);
  return Array.from({ length }, (_, i) => i + 1);
}

export function getPriorityRankOptions(queue = [], currentRank = null) {
  const occupied = new Set(getOccupiedPriorityRanks(queue));
  const current = Number(currentRank) > 0 ? Number(currentRank) : null;
  const labels = new Map(
    (Array.isArray(queue) ? queue : [])
      .filter((item) => Number(item?.rank) > 0)
      .map((item) => [Number(item.rank), item.label || ''])
  );

  return getVisiblePriorityRanks(queue, current).map((rank) => {
    const selected = occupied.has(rank) || current === rank;
    return {
      rank,
      selected,
      current: current === rank,
      label: labels.get(rank) || '',
      assignable: !selected || current != null
    };
  });
}

export function getTaskPriorityRank(task) {
  const rank = Number(task?.priorityRank);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}

export function getPriorityRankSortValue(task) {
  const rank = getTaskPriorityRank(task);
  return rank == null ? Number.POSITIVE_INFINITY : rank;
}

function getDeadlineSortValue(task) {
  if (!task?.deadline) return Number.POSITIVE_INFINITY;
  const value = new Date(task.deadline).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function sortActiveTasksForEmployeeStack(
  tasks,
  { blockedBottomSort = false, isBlocked = () => false } = {}
) {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const rankDiff = getPriorityRankSortValue(a.task) - getPriorityRankSortValue(b.task);
      if (rankDiff) return rankDiff;

      if (blockedBottomSort) {
        const blockedDiff = Number(Boolean(isBlocked(a.task))) - Number(Boolean(isBlocked(b.task)));
        if (blockedDiff) return blockedDiff;
      }

      const deadlineDiff = getDeadlineSortValue(a.task) - getDeadlineSortValue(b.task);
      return deadlineDiff || a.index - b.index;
    })
    .map(({ task }) => task);
}
