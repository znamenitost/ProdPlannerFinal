import { useMemo } from 'react';
import { Card } from '@mui/material';
import DayHeader from './calendar/DayHeader';
import PlannedBlocks from './calendar/PlannedBlocks';
import DeadlineMarkers from './calendar/DeadlineMarkers';
import TimelineSegments from './calendar/TimelineSegments';
import { useClockMinuteTick } from '../context/ClockContext';
import {
  buildTaskBlocksMap,
  extendTimelineToNow,
  getTaskInfoForDeadline,
  getTimelineSegments,
  mergeWorkSegmentsByTask,
  isSameCalendarDay,
  isWorkingWeekday
} from '../utils/calendarDayUtils';

export default function DayColumn({
  day,
  allDays,
  taskBlocksMap: taskBlocksMapProp = null,
  highlightedTaskId,
  onTaskHover,
  detailedTimeline = false
}) {
  const date = new Date(day.date);
  const isWorkingDay = isWorkingWeekday(date);
  const isToday = isSameCalendarDay(date, new Date());
  const clockTick = useClockMinuteTick(isToday);
  const taskBlocksMap = taskBlocksMapProp ?? buildTaskBlocksMap(allDays);

  const rawTimelineSegments = useMemo(() => {
    const base = mergeWorkSegmentsByTask(getTimelineSegments(day.timeline));
    return isToday ? extendTimelineToNow(base, date) : base;
  }, [day.timeline, date, isToday, clockTick]);
  const workSegments = rawTimelineSegments.filter((s) => s.type === 'work');
  const idleSegments = rawTimelineSegments
    .filter((s) => s.type === 'idle')
    .filter((segment) => !workSegments.some((ws) => ws.start < segment.end && ws.end > segment.start));

  const isHighlighted = (block) => highlightedTaskId === block.taskId;
  const getTaskInfo = (taskId, taskTitle, status) =>
    getTaskInfoForDeadline(taskBlocksMap, taskId, taskTitle, status);

  return (
    <Card variant="nested" sx={{ p: 2 }}>
      <DayHeader date={day.date} />
      <PlannedBlocks
        taskBlocks={day.taskBlocks}
        lunchIntervals={day.lunchIntervals}
        isWorkingDay={isWorkingDay}
        isHighlighted={isHighlighted}
        detailedTimeline={detailedTimeline}
      />
      <DeadlineMarkers
        deadlines={day.deadlines}
        getTaskInfo={getTaskInfo}
        onTaskHover={onTaskHover}
      />
      <TimelineSegments
        workSegments={workSegments}
        idleSegments={idleSegments}
        lunchIntervals={day.lunchIntervals}
        isWorkingDay={isWorkingDay}
        detailedTimeline={detailedTimeline}
        dayDate={day.date}
      />
    </Card>
  );
}
