import { Chip, Tooltip } from '@mui/material';
import { useTextLimit } from '../../context/TextLimitContext';

const chipSx = {
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  height: 'auto',
  maxWidth: '100%',
  '& .MuiChip-label': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
};

export default function TaskTypeCell({ type }) {
  const limit = useTextLimit();
  const text = type || '—';
  const truncated = text.length > limit ? text.slice(0, limit) + '…' : text;
  const showTooltip = text.length > limit;

  const chip = <Chip label={truncated} size="small" variant="outlined" sx={chipSx} />;

  return showTooltip ? <Tooltip title={text} arrow>{chip}</Tooltip> : chip;
}
