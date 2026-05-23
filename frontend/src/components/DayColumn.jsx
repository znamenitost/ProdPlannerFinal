import { Paper } from '@mui/material';
import { glassCardSx } from '../theme/surfaces';
import DayHeader from './calendar/DayHeader';
import PlannedBlocks from './calendar/PlannedBlocks';
import DeadlineMarkers from './calendar/DeadlineMarkers';
import TimelineSegments from './calendar/TimelineSegments';
import {
  buildTaskBlocksMap,
  getTaskInfoForDeadline,
  getTimelineSegments,
  isWorkingWeekday
} from '../utils/calendarDayUtils';

export default function DayColumn({
  day,
  allDays,
  highlightedTaskId,
  onTaskHover,
  detailedTimeline = false
}) {
  const date = new Date(day.date);
  const isWorkingDay = isWorkingWeekday(date);
  const taskBlocksMap = buildTaskBlocksMap(allDays);

  const rawTimelineSegments = getTimelineSegments(day.date, day.timeline);
  const workSegments = rawTimelineSegments.filter((s) => s.type === 'work');
  const idleSegments = rawTimelineSegments
    .filter((s) => s.type === 'idle')
    .filter((segment) => !workSegments.some((ws) => ws.start < segment.end && ws.end > segment.start));

  const isHighlighted = (block) => highlightedTaskId === block.taskId;
  const getTaskInfo = (taskId, taskTitle, status) =>
    getTaskInfoForDeadline(taskBlocksMap, taskId, taskTitle, status);

  return (
    <Paper elevation={0} sx={{ ...glassCardSx, p: 2, borderRadius: 2 }}>
      <DayHeader date={day.date} />
      <PlannedBlocks
        taskBlocks={day.taskBlocks}
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
        isWorkingDay={isWorkingDay}
        detailedTimeline={detailedTimeline}
        dayDate={day.date}
      />
    </Paper>
  );
}
