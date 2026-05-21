export const CALENDAR_TOOLTIP_SX = {
  bgcolor: '#1e293b',
  fontSize: '12px',
  padding: '8px 15px',
  minWidth: '350px',
  maxWidth: 'none',
  width: 'max-content',
  borderRadius: 2,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
};

export function getLeft(dateTime) {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - 10) / 9) * 100;
}

export function getWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  return (duration / 9) * 100;
}

export function getDuration(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return ((e - s) / (1000 * 60 * 60)).toFixed(1);
}

export function formatCalendarTime(dateTime) {
  return new Date(dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function isWorkingWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getWorkColor(taskId, completed) {
  if (completed) return '#86b386';
  const colors = ['#7c9ebf', '#9bb5d4', '#a8c4e0', '#b8d0e8', '#8aadc9', '#6b8fae'];
  return colors[taskId % colors.length];
}

export function getTimelineSegments(dayDate, timeline) {
  if (!timeline?.length) return [];

  const date = new Date(dayDate);
  const segments = [];
  const lunchStart = new Date(date);
  lunchStart.setHours(14, 0, 0, 0);
  const lunchEnd = new Date(date);
  lunchEnd.setHours(15, 0, 0, 0);

  timeline.forEach((segment) => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);

    if (segment.type === 'work') {
      if (start < lunchEnd && end > lunchStart) {
        if (start < lunchStart) {
          const beforeLunchEnd = end < lunchStart ? end : lunchStart;
          if (beforeLunchEnd > start) {
            segments.push({ ...segment, start, end: beforeLunchEnd });
          }
        }
        if (end > lunchEnd) {
          const afterLunchStart = start > lunchEnd ? start : lunchEnd;
          if (end > afterLunchStart) {
            segments.push({ ...segment, start: afterLunchStart, end });
          }
        }
      } else {
        segments.push({ ...segment, start, end });
      }
    } else {
      const isLunchTime =
        (start >= lunchStart && start < lunchEnd)
        || (end > lunchStart && end <= lunchEnd)
        || (start <= lunchStart && end >= lunchEnd);
      if (!isLunchTime) {
        segments.push({ ...segment, start, end });
      }
    }
  });

  return segments.sort((a, b) => new Date(a.start) - new Date(b.start));
}

export function buildTaskBlocksMap(allDays) {
  const taskBlocksMap = new Map();
  allDays?.forEach((d) => {
    d.taskBlocks?.forEach((block) => {
      if (!block.taskId) return;
      if (!taskBlocksMap.has(block.taskId)) taskBlocksMap.set(block.taskId, []);
      taskBlocksMap.get(block.taskId).push({ ...block, dayDate: d.date });
    });
  });
  return taskBlocksMap;
}

export function getTaskInfoForDeadline(taskBlocksMap, deadlineTaskId, deadlineTaskTitle, deadlineStatus) {
  if (deadlineStatus === 'Completed') {
    return {
      title: deadlineTaskTitle,
      totalHours: 0,
      blocksCount: 0,
      blocks: [],
      hasBlocks: false,
      isCompleted: true
    };
  }
  const blocks = taskBlocksMap.get(deadlineTaskId);
  if (blocks?.length) {
    const firstBlock = blocks[0];
    let totalHours = 0;
    blocks.forEach((b) => { totalHours += b.hours; });
    return {
      title: firstBlock.fullTitle || firstBlock.title,
      totalHours,
      blocksCount: blocks.length,
      blocks,
      hasBlocks: true,
      isCompleted: false
    };
  }
  if (deadlineTaskTitle) {
    return {
      title: deadlineTaskTitle,
      totalHours: 0,
      blocksCount: 0,
      blocks: [],
      hasBlocks: false,
      isCompleted: false
    };
  }
  return null;
}
