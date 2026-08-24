import { Box, Popover } from '@mui/material';
import { useState } from 'react';
import LazyTooltip from '../common/LazyTooltip';
import { getTaskPriorityRank } from '../../utils/taskPriorityRank';
import PriorityRankPicker from './PriorityRankPicker';
import { TaskPriorityRankMark } from './TaskPriorityRankMark';

export { TaskPriorityRankMark };

export function TaskPriorityMark({ size = 22 }) {
  return <TaskPriorityRankMark rank="" selected size={size} />;
}

export default function TaskPriorityChip({
  task,
  onSelectRank,
  pending = false
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const rank = getTaskPriorityRank(task);
  if (rank == null) return null;

  const canEdit = typeof onSelectRank === 'function';
  const open = Boolean(anchorEl);

  const mark = (
    <Box
      component={canEdit ? 'button' : 'span'}
      type={canEdit ? 'button' : undefined}
      aria-label={`Очередь ${rank}`}
      disabled={canEdit ? pending : undefined}
      onClick={
        canEdit
          ? (event) => {
              event.stopPropagation();
              if (pending) return;
              setAnchorEl(event.currentTarget);
            }
          : undefined
      }
      sx={{
        display: 'inline-flex',
        p: 0,
        m: 0,
        border: 0,
        background: 'none',
        cursor: canEdit ? 'pointer' : 'default',
        verticalAlign: 'middle',
        lineHeight: 0
      }}
    >
      <TaskPriorityRankMark rank={rank} selected />
    </Box>
  );

  return (
    <>
      <LazyTooltip title={canEdit ? `Очередь ${rank} — нажмите, чтобы изменить` : `Очередь ${rank}`} arrow>
        {mark}
      </LazyTooltip>
      {canEdit && (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          onClick={(event) => event.stopPropagation()}
        >
          <PriorityRankPicker
            queue={task?.priorityQueue}
            currentRank={rank}
            allowOccupied
            disabled={pending}
            onSelect={(nextRank) => {
              setAnchorEl(null);
              onSelectRank(task, nextRank);
            }}
            onClear={() => {
              setAnchorEl(null);
              onSelectRank(task, null);
            }}
          />
        </Popover>
      )}
    </>
  );
}
