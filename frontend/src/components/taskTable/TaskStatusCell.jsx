import { Chip } from '@mui/material';
import { getStatusIcon } from '../../utils/taskHelpers';
import { getStatusChipColor } from '../../theme/statusColors';

export default function TaskStatusCell({ statusText, label }) {
  const displayLabel = label ?? statusText ?? 'Назначена';
  const displayStatus = statusText || 'Назначена';
  const icon = getStatusIcon(displayStatus);

  return (
    <Chip
      icon={icon || undefined}
      label={displayLabel}
      size="small"
      color={getStatusChipColor(displayStatus)}
      variant="filled"
      sx={{
        fontSize: '0.7rem',
        height: 22,
        minWidth: 88,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        '& .MuiChip-icon': { fontSize: 16, ml: 0.5 }
      }}
    />
  );
}
