import { forwardRef } from 'react';
import { Box, Collapse, Fade, Grow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { fadeEnterTimeout, fadeExitTimeout, growTimeout } from '../../theme/motion';

export const MotionFade = forwardRef(function MotionFade(
  { children, in: inProp = true, appear = false, sx, ...rest },
  ref
) {
  const theme = useTheme();
  return (
    <Fade
      in={inProp}
      appear={appear}
      timeout={{
        enter: fadeEnterTimeout(theme),
        exit: fadeExitTimeout(theme)
      }}
      easing={{
        enter: theme.transitions.easing.easeOut,
        exit: theme.transitions.easing.easeIn
      }}
      {...rest}
    >
      <Box ref={ref} sx={sx}>
        {children}
      </Box>
    </Fade>
  );
});

export function MotionSwitch({ transitionKey, children, sx, mode = 'fade' }) {
  const theme = useTheme();

  if (mode === 'grow') {
    return (
      <Grow
        in
        appear
        key={transitionKey}
        timeout={growTimeout(theme)}
        easing={theme.transitions.easing.easeOut}
      >
        <Box sx={sx}>{children}</Box>
      </Grow>
    );
  }

  return (
    <Fade
      in
      appear
      key={transitionKey}
      timeout={{
        enter: fadeEnterTimeout(theme),
        exit: fadeExitTimeout(theme)
      }}
      easing={{
        enter: theme.transitions.easing.easeOut,
        exit: theme.transitions.easing.easeIn
      }}
    >
      <Box sx={sx}>{children}</Box>
    </Fade>
  );
}

export function MotionCollapse({ in: inProp, children, sx, ...rest }) {
  const theme = useTheme();
  return (
    <Collapse
      in={inProp}
      timeout={theme.transitions.duration.standard}
      easing={theme.transitions.easing.easeInOut}
      {...rest}
    >
      <Box sx={sx}>{children}</Box>
    </Collapse>
  );
}
