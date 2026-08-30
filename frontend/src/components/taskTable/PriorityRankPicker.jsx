import { Box, Button, IconButton } from '@mui/material';
import { getPriorityRankAssignment, getPriorityRankOptions } from '../../utils/taskPriorityRank';
import { TaskPriorityRankMark } from './TaskPriorityRankMark';

export default function PriorityRankPicker({
  queue = [],
  currentRank = null,
  disabled = false,
  onSelect,
  onClear
}) {
  const options = getPriorityRankOptions(queue, currentRank);

  return (
    <Box sx={{ px: 1, py: 0.75, minWidth: 168 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
        {options.map((option) => {
          const assignment = getPriorityRankAssignment(option);
          return (
            <IconButton
              key={option.rank}
              size="small"
              disabled={disabled}
              aria-label={
                assignment?.joinWave
                  ? `Волна ${option.rank} — параллельно${option.label ? `: ${option.label}` : ''}`
                  : option.current
                    ? `Текущий номер ${option.rank}`
                    : `Свободный номер ${option.rank}`
              }
              title={option.label || undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled || !assignment) return;
                onSelect?.(assignment.rank, { joinWave: assignment.joinWave });
              }}
              sx={{
                p: 0.25,
                borderRadius: '50%',
                opacity: disabled ? 0.4 : 1
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
