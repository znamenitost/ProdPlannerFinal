import { Box, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '../../theme/paletteTokens';
import { Restaurant } from '@mui/icons-material';
import {
  CALENDAR_TOOLTIP_SX,
  formatCalendarTime,
  getDuration,
  getLeft,
  getWidth,
  getWorkColor
} from '../../utils/calendarDayUtils';

function LunchBreak({ opacity = 0.7 }) {
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
          left: '44.444%',
          width: '11.111%',
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

export default function TimelineSegments({ workSegments, idleSegments, isWorkingDay }) {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: tokens.track,
        height: 36,
        borderRadius: 2,
        mb: 2,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      {isWorkingDay && <LunchBreak />}

      {workSegments.map((segment, idx) => {
        const layer = segment.layer ?? 0;
        const maxDepth = segment.maxDepth ?? 1;
        const layerHeight = 36 / maxDepth;
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
                left: `${getLeft(segment.start)}%`,
                width: `${getWidth(segment.start, segment.end)}%`,
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
        const idleTop = 36 - 4;
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
                left: `${getLeft(segment.start)}%`,
                width: `${getWidth(segment.start, segment.end)}%`,
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
  );
}
