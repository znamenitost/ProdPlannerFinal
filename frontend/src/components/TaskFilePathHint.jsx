import { Typography } from '@mui/material';
import { getTaskFilePathHint } from '../utils/cdrPreviewErrors';

export default function TaskFilePathHint({ folderPath, fileName }) {
  const hint = getTaskFilePathHint(folderPath, fileName);
  if (!hint) return null;

  return (
    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, lineHeight: 1.3 }}>
      {hint}
    </Typography>
  );
}
