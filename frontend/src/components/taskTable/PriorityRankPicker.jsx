import { Box, Button, IconButton } from '@mui/material';
import { getPriorityRankOptions } from '../../utils/taskPriorityRank';
import { TaskPriorityRankMark } from './TaskPriorityRankMark';

export default function PriorityRankPicker({
  queue = [],
  currentRank = null,
  allowOccupied = false,
  disabled = false,
  onSelect,
  onClear
}) {
  const options = getPriorityRankOptions(queue, currentRank);

  return (
    <Box sx={{ px: 1, py: 0.75, minWidth: 168 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
        {options.map((option) => {
          const clickable = !disabled && (allowOccupied || option.assignable);
          return (
            <IconButton
              key={option.rank}
              size="small"
              disabled={!clickable}
              aria-label={
                option.selected
                  ? option.current
                    ? `Текущий номер ${option.rank}`
                    : `Занятый номер ${option.rank}${option.label ? `: ${option.label}` : ''}`
                  : `Свободный номер ${option.rank}`
              }
              title={option.label || undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (!clickable || option.current) return;
                onSelect?.(option.rank);
              }}
              sx={{
                p: 0.25,
                opacity: clickable ? 1 : 0.4
              }}
            >
              <TaskPriorityRankMark rank={option.rank} selected={option.selected} />
            </IconButton>
          );
        })}
      </Box>
      {currentRank != null && onClear && (
        <Button
          fullWidth
          size="small"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          sx={{ mt: 0.5 }}
        >
          Убрать
        </Button>
      )}
    </Box>
  );
}
