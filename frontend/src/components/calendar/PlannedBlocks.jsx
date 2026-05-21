import { Box, Tooltip } from '@mui/material';
import { Restaurant } from '@mui/icons-material';
import { CALENDAR_TOOLTIP_SX } from '../../utils/calendarDayUtils';

function LunchBreak() {
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
          backgroundColor: '#fef3c7',
          opacity: 0.8,
          zIndex: 1,
          cursor: 'pointer',
          borderRight: '1px solid rgba(0,0,0,0.05)',
          '&:hover': { opacity: 1 }
        }}
      />
    </Tooltip>
  );
}

export default function PlannedBlocks({ taskBlocks, isWorkingDay, isHighlighted }) {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#f1f5f9',
        height: 32,
        borderRadius: 2,
        mb: 3,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      {taskBlocks?.map((block, idx) => {
        const highlighted = isHighlighted(block);
        const isFirst = idx === 0;
        const isLast = idx === taskBlocks.length - 1;
        return (
          <Tooltip
            key={idx}
            title={`${block.fullTitle || block.title}: ${block.hours.toFixed(1)} ч`}
            arrow
            placement="top"
            slotProps={{ tooltip: { sx: CALENDAR_TOOLTIP_SX } }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${block.leftPercent}%`,
                width: `${block.widthPercent}%`,
                height: '100%',
                top: 0,
                backgroundColor: highlighted ? '#f59e0b' : '#7c9ebf',
                opacity: highlighted ? 0.95 : 0.85,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRight: idx !== taskBlocks.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                borderTopLeftRadius: isFirst ? 2 : 0,
                borderBottomLeftRadius: isFirst ? 2 : 0,
                borderTopRightRadius: isLast ? 2 : 0,
                borderBottomRightRadius: isLast ? 2 : 0,
                boxShadow: highlighted ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                '&:hover': { opacity: 1, filter: 'brightness(0.95)' }
              }}
            />
          </Tooltip>
        );
      })}
      {isWorkingDay && <LunchBreak />}
      {taskBlocks?.map((block, idx) => {
        const highlighted = isHighlighted(block);
        return (
          <Box
            key={`label-${idx}`}
            sx={{
              position: 'absolute',
              left: `${block.leftPercent + block.widthPercent / 2}%`,
              top: -22,
              transform: 'translateX(-50%)',
              backgroundColor: highlighted ? '#f59e0b' : '#1e293b',
              color: 'white',
              fontSize: '10px',
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: '12px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              zIndex: 15,
              pointerEvents: 'none',
              opacity: 0.9
            }}
          >
            {block.hours.toFixed(1)}ч
          </Box>
        );
      })}
    </Box>
  );
}
