import { Box, Popover } from '@mui/material';
import { useRef, useState } from 'react';
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
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const rank = getTaskPriorityRank(task);
  if (rank == null) return null;

  const canEdit = typeof onSelectRank === 'function';

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
              setOpen(true);
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
      <Box
        ref={anchorRef}
        component="span"
        sx={{ display: 'inline-flex', lineHeight: 0, verticalAlign: 'middle' }}
      >
        <LazyTooltip title={canEdit ? `Очередь ${rank} — нажмите, чтобы изменить` : `Очередь ${rank}`} arrow>
          {mark}
        </LazyTooltip>
      </Box>
      {canEdit && (
        <Popover
          open={open}
          anchorEl={anchorRef.current}
          onClose={() => setOpen(false)}
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
              setOpen(false);
              onSelectRank(task, nextRank);
            }}
            onClear={() => {
              setOpen(false);
              onSelectRank(task, null);
            }}
          />
        </Popover>
      )}
    </>
  );
}
