import { Paper, Box, Typography } from '@mui/material';
import { sectionHeaderSx, sectionTitleRowSx } from '../../theme/surfaces';
import { MotionFade } from './MotionSection';

/**
 * Unified section container: glass paper + optional icon title + actions.
 */
export default function SectionCard({
  title,
  icon,
  action,
  children,
  sx,
  contentSx,
  disablePadding = false,
  ...paperProps
}) {
  return (
    <MotionFade appear>
    <Paper variant="section" sx={sx} {...paperProps}>
      {(title || action) && (
        <Box sx={sectionHeaderSx}>
          <Box sx={sectionTitleRowSx}>
            {icon}
            {title && (
              <Typography variant="h2" component="h2">
                {title}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
      )}
      <Box sx={disablePadding ? contentSx : [{ mt: title || action ? 0 : 0 }, contentSx]}>
        {children}
      </Box>
    </Paper>
    </MotionFade>
  );
}
