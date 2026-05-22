import { Box, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '../../theme/paletteTokens';
import { Restaurant } from '@mui/icons-material';
import {
  CALENDAR_TOOLTIP_SX,
  formatCalendarTime,
  getDuration,
  getLeft,
  getLunchBandPercent,
  getTimelineRange,
  getWidth,
  getWorkColor
} from '../../utils/calendarDayUtils';
import TimelineHourAxis from './TimelineHourAxis';

function LunchBreak({ range, opacity = 0.7 }) {
  const { left, width } = getLunchBandPercent(range);
  return (
    <Tooltip
      title={(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Restaurant fontSize="small" /> Обед (14:00–15:00)
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
  isWorkingDay,
  detailedTimeline = false
}) {
  const range = getTimelineRange(detailedTimeline);
  const trackHeight = detailedTimeline ? 48 : 36;

  return (
    <Box sx={{ mb: detailedTimeline ? 0 : 2 }}>
      <Box
        sx={{
          position: 'relative',
          bgcolor: tokens.track,
          height: trackHeight,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        {isWorkingDay && <LunchBreak range={range} />}

        {workSegments.map((segment, idx) => {
          const layer = segment.layer ?? 0;
          const maxDepth = segment.maxDepth ?? 1;
          const layerHeight = trackHeight / maxDepth;
          const topPos = layer * layerHeight;
          const segmentHeight = layerHeight - 1;

          return (
            <Tooltip
              key={`work-${idx}`}
              title={`${segment.taskTitle || `Задача #${segment.taskId}`}\n⏱ ${formatCalendarTime(segment.start)} - ${formatCalendarTime(segment.end)} (${getDuration(segment.start, segment.end)} ч)`}
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
                  opacity: 0.85,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderRadius: '2px',
                  zIndex: 2,
                  '&:hover': { opacity: 1, filter: 'brightness(0.95)' }
                }}
              />
            </Tooltip>
          );
        })}

        {idleSegments.map((segment, idx) => {
          const idleTop = trackHeight - 4;
          const idleHeight = 4;
          return (
            <Tooltip
              key={`idle-${idx}`}
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
                  transition: 'all 0.2s ease',
                  zIndex: 1,
                  '&:hover': { opacity: 0.9 }
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      {detailedTimeline && (
        <TimelineHourAxis startHour={range.start} endHour={range.end} />
      )}
    </Box>
  );
}
