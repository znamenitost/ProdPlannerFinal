import { Chip } from '@mui/material';
import { getStatusColor, getStatusIcon } from '../../utils/taskHelpers';

export default function TaskStatusCell({ statusText, label }) {
  const displayLabel = label ?? statusText ?? 'Назначена';
  const displayStatus = statusText || 'Назначена';
  return (
    <Chip
      icon={getStatusIcon(displayStatus)}
      label={displayLabel}
      size="small"
      sx={{
        bgcolor: getStatusColor(displayStatus),
        color: 'white',
        fontSize: '0.7rem',
        whiteSpace: 'nowrap'
      }}
    />
  );
}
