import { Paper, Box, Typography } from '@mui/material';
import { glassPaperSx, sectionHeaderSx, sectionTitleRowSx } from '../../theme/surfaces';

export default function SectionCard({ title, icon, action, children, sx, contentSx, ...paperProps }) {
  return (
    <Paper sx={[glassPaperSx, sx]} {...paperProps}>
      {(title || action) && (
        <Box sx={sectionHeaderSx}>
          <Box sx={sectionTitleRowSx}>
            {icon}
            {title && <Typography variant="h2" component="h2">{title}</Typography>}
          </Box>
          {action}
        </Box>
      )}
      <Box sx={contentSx}>{children}</Box>
    </Paper>
  );
}
