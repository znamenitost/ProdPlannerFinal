/** Склеивает work-сегменты одной задачи, если их порезали границами других задач на бэкенде. */
export function mergeWorkSegmentsByTask(segments) {
  if (!segments?.length) return segments;

  const work = segments.filter((s) => s.type === 'work');
  const rest = segments.filter((s) => s.type !== 'work');
  if (work.length === 0) return segments;

  const mergedWork = [];
  const groups = new Map();

  for (const seg of work) {
    if (seg.taskId == null) {
      mergedWork.push(seg);
      continue;
    }
    if (!groups.has(seg.taskId)) groups.set(seg.taskId, []);
    groups.get(seg.taskId).push(seg);
  }

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.start - b.start);
    let current = { ...ordered[0] };

    for (let i = 1; i < ordered.length; i += 1) {
      const next = ordered[i];
      if (next.start <= current.end) {
        current = {
          ...current,
          start: next.start < current.start ? next.start : current.start,
          end: next.end > current.end ? next.end : current.end,
          isOpenInterval: Boolean(current.isOpenInterval || next.isOpenInterval),
          completed: Boolean(current.completed && next.completed)
        };
      } else {
        mergedWork.push(current);
        current = { ...next };
      }
    }
    mergedWork.push(current);
  }

  return [...mergedWork, ...rest].sort((a, b) => a.start - b.start);
}
