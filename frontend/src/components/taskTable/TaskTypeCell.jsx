import { Chip, Tooltip } from '@mui/material';

const chipSx = {
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  height: 'auto',
  '& .MuiChip-label': { whiteSpace: 'nowrap' }
};

export default function TaskTypeCell({ type }) {
  return (
    <Tooltip title={type} arrow>
      <Chip label={type || '—'} size="small" variant="outlined" sx={chipSx} />
    </Tooltip>
  );
}
