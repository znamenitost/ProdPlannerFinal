import { Box, Button, IconButton, Switch, Typography } from '@mui/material';
import { useState } from 'react';
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
  const [joinWave, setJoinWave] = useState(false);
  const options = getPriorityRankOptions(queue, currentRank);
  const hasOccupied = options.some((option) => option.selected && !option.current);

  return (
    <Box sx={{ px: 1, py: 0.75, minWidth: 168 }}>
      {hasOccupied && (
        <Box
          component="label"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            cursor: 'pointer',
            pb: 0.25
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <Switch
            size="small"
            checked={joinWave}
            disabled={disabled}
            onChange={(event) => setJoinWave(event.target.checked)}
            inputProps={{ 'aria-label': 'Встать в ту же волну параллельно' }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            В ту же волну
          </Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
        {options.map((option) => {
          const clickable = !disabled && (allowOccupied || option.assignable);
          const joinTarget = joinWave && option.selected && !option.current;
          return (
            <IconButton
              key={option.rank}
              size="small"
              disabled={!clickable}
              aria-label={
                joinTarget
                  ? `Волна ${option.rank} — параллельно${option.label ? `: ${option.label}` : ''}`
                  : option.selected
                    ? option.current
                      ? `Текущий номер ${option.rank}`
                      : `Занятый номер ${option.rank}${option.label ? `: ${option.label}` : ''}`
                    : `Свободный номер ${option.rank}`
              }
              title={option.label || undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (!clickable || option.current) return;
                onSelect?.(option.rank, { joinWave: joinTarget });
              }}
              sx={{
                p: 0.25,
                borderRadius: '50%',
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
