import { useState } from 'react';
import { MenuItem, ListItemIcon, ListItemText, Box } from '@mui/material';
import { getTaskPriorityRank } from '../../utils/taskPriorityRank';
import { TaskPriorityRankMark } from './TaskPriorityRankMark';
import PriorityRankPicker from './PriorityRankPicker';

export default function PriorityRankMenuItem({
  task,
  disabled = false,
  onSelectRank,
  onParentClose
}) {
  const [open, setOpen] = useState(false);
  const rank = getTaskPriorityRank(task);
  const canClear = rank != null;

  const handleSelect = (nextRank, options) => {
    setOpen(false);
    onParentClose?.();
    onSelectRank?.(task, nextRank, options);
  };

  return (
    <>
      <MenuItem
        disabled={disabled || !onSelectRank}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onMouseEnter={() => {
          if (disabled || !onSelectRank) return;
          setOpen(true);
        }}
      >
        <ListItemIcon>
          <TaskPriorityRankMark rank={rank ?? '·'} selected={rank != null} />
        </ListItemIcon>
        <ListItemText>{rank != null ? `Очередь · ${rank}` : 'Пометить'}</ListItemText>
      </MenuItem>
      {open && (
        <Box sx={{ px: 0.5, pb: 0.75 }} onClick={(event) => event.stopPropagation()}>
          <PriorityRankPicker
            queue={task?.priorityQueue}
            currentRank={rank}
            disabled={disabled}
            onSelect={handleSelect}
            onClear={canClear ? () => handleSelect(null) : undefined}
          />
        </Box>
      )}
    </>
  );
}
