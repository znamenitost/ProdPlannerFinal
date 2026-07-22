import { useMemo } from 'react';
import { Box, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '../../theme/paletteTokens';
import { calendarBlockLayoutTransitionSx } from '../../theme/motion';
import { Restaurant } from '@mui/icons-material';
import {
  CALENDAR_TOOLTIP_SX,
  formatCalendarTaskTooltip,
  formatCalendarTime,
  getDuration,
  getIntervalBandPercent,
  getLeft,
  getNowMarkerPercent,
  getTimelineRange,
  getWidth,
  getWorkColor,
  isFussTimelineSegment,
  FUSS_TIMELINE_OPACITY,
  isSameCalendarDay
} from '../../utils/calendarDayUtils';
import TimelineHourAxis from './TimelineHourAxis';
import TimelineGridLines from './TimelineGridLines';
import { useClockMinuteTick } from '../../context/ClockContext';

function LunchBreak({ interval, range, opacity = 0.7 }) {
  const endTime = interval.endTime ?? interval.end ?? new Date();
  const { left, width } = getIntervalBandPercent(interval.startTime ?? interval.start, endTime, range);
  return (
    <Tooltip
      title={(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Restaurant fontSize="small" /> Обед ({formatCalendarTime(interval.startTime ?? interval.start)}–{formatCalendarTime(endTime)})
        </Box>
      )}
      arrow
      placement="top"
      slotProps={{ tooltip: { sx: CALENDAR_TOOLTIP_SX } }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: `${left}%`,
          width: `${width}%`,
          height: '100%',
          top: 0,
          backgroundColor: tokens.lunch,
          opacity,
          zIndex: 1,
          cursor: 'pointer',
          borderRight: '1px solid rgba(0,0,0,0.05)',
          '&:hover': { opacity: opacity + 0.2 }
        }}
      />
    </Tooltip>
  );
}

export default function TimelineSegments({
  workSegments,
  idleSegments,
  lunchIntervals = [],
  isWorkingDay,
  detailedTimeline = false,
  dayDate = null
}) {
  const range = getTimelineRange(detailedTimeline);
  const trackHeight = detailedTimeline ? 48 : 36;
  const axisBlockHeight = 26;

  const isToday =
    detailedTimeline && dayDate && isSameCalendarDay(dayDate, new Date());
  const clockTick = useClockMinuteTick(isToday);
  const now = useMemo(() => new Date(), [clockTick, isToday]);
  const nowLeft = isToday ? getNowMarkerPercent(now, range) : null;

  const track = (
    <Box
      sx={{
        position: 'relative',
        bgcolor: tokens.track,
        height: trackHeight,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
        zIndex: 1
      }}
    >
      {detailedTimeline && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <TimelineGridLines range={range} />
        </Box>
      )}

      {isWorkingDay && lunchIntervals.map((interval, idx) => (
        <LunchBreak
          key={`lunch-${new Date(interval.startTime ?? interval.start).getTime()}-${idx}`}
          interval={interval}
          range={range}
        />
      ))}

      {workSegments.map((segment, idx) => {
        const layer = segment.layer ?? 0;
        const maxDepth = segment.maxDepth ?? 1;
        const layerHeight = trackHeight / maxDepth;
        const topPos = layer * layerHeight;
        const segmentHeight = layerHeight - 1;
        const segmentKey = `work-${segment.taskId ?? idx}-${new Date(segment.start).getTime()}`;

        return (
          <Tooltip
            key={segmentKey}
            title={formatCalendarTaskTooltip(
              segment,
              `⏱ ${formatCalendarTime(segment.start)} - ${formatCalendarTime(segment.end)} (${getDuration(segment.start, segment.end)} ч)`
            )}
            arrow
            placement="top"
            slotProps={{ tooltip: { sx: CALENDAR_TOOLTIP_SX } }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${getLeft(segment.start, range)}%`,
                width: `${getWidth(segment.start, segment.end, range)}%`,
                height: `${segmentHeight}px`,
                top: `${topPos}px`,
                backgroundColor: getWorkColor(segment.taskId, segment.completed),
                opacity: isFussTimelineSegment(segment) ? FUSS_TIMELINE_OPACITY : 0.85,
                cursor: 'pointer',
                ...calendarBlockLayoutTransitionSx,
                borderRadius: '2px',
                zIndex: 2
              }}
            />
          </Tooltip>
        );
      })}

      {idleSegments.map((segment, idx) => {
        const idleTop = trackHeight - 4;
        const idleHeight = 4;
        const segmentKey = `idle-${new Date(segment.start).getTime()}-${new Date(segment.end).getTime()}`;
        return (
          <Tooltip
            key={segmentKey}
            title={`Простой\n⏱ ${formatCalendarTime(segment.start)} - ${formatCalendarTime(segment.end)} (${getDuration(segment.start, segment.end)} ч)`}
            arrow
            placement="top"
            slotProps={{ tooltip: { sx: CALENDAR_TOOLTIP_SX } }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${getLeft(segment.start, range)}%`,
                width: `${getWidth(segment.start, segment.end, range)}%`,
                height: `${idleHeight}px`,
                top: `${idleTop}px`,
                backgroundColor: (theme) => alpha(theme.palette.secondary.light, 0.85),
                opacity: 0.7,
                cursor: 'pointer',
                ...calendarBlockLayoutTransitionSx,
                zIndex: 2
              }}
            />
          </Tooltip>
        );
      })}

    </Box>
  );

  if (!detailedTimeline) {
    return <Box sx={{ mb: 2 }}>{track}</Box>;
  }

  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: trackHeight + axisBlockHeight,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        <TimelineGridLines range={range} />
      </Box>

      {track}

      <Box sx={{ position: 'relative', zIndex: 1, mt: 0.5 }}>
        <TimelineHourAxis
          startHour={range.start}
          endHour={range.end}
          nowLeft={nowLeft}
        />
      </Box>
    </Box>
  );
}
