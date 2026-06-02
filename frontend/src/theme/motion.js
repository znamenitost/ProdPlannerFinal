import { alpha } from '@mui/material/styles';

/**
 * Единая точка для анимаций MUI: theme.transitions + готовые sx.
 */

export function createMuiTransition(theme, props, options = {}) {
  const duration = options.duration ?? theme.transitions.duration.short;
  const easing = options.easing ?? theme.transitions.easing.easeInOut;
  const delay = options.delay ?? 0;
  return theme.transitions.create(props, { duration, easing, delay });
}

export function fadeEnterTimeout(theme) {
  return theme.transitions.duration.enteringScreen;
}

export function fadeExitTimeout(theme) {
  return theme.transitions.duration.leavingScreen;
}

export function growTimeout(theme) {
  return theme.transitions.duration.enteringScreen;
}

/** Resolved panel hover for `createTheme` component variants. */
export function panelHoverThemeStyles(theme) {
  return {
    transition: createMuiTransition(theme, ['box-shadow', 'transform', 'border-color']),
    '@media (prefers-reduced-motion: reduce)': {
      transition: createMuiTransition(theme, ['box-shadow', 'border-color'])
    },
    '&:hover': {
      boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.1)}`,
      borderColor: alpha(theme.palette.primary.main, 0.22),
      transform: 'translateY(-2px)',
      '@media (prefers-reduced-motion: reduce)': {
        transform: 'none'
      }
    }
  };
}

/** Section `Paper` (padding + hover); used by `MuiPaper` variant `section`. */
export function sectionPaperThemeStyles(theme) {
  return {
    padding: theme.spacing(2),
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(3)
    },
    borderRadius: theme.spacing(2.5),
    backgroundColor: theme.palette.background.paper,
    ...panelHoverThemeStyles(theme)
  };
}

export const hoverInteractiveSx = {
  transition: (theme) =>
    createMuiTransition(theme, ['opacity', 'filter', 'box-shadow'], {
      duration: theme.transitions.duration.shorter
    }),
  '&:hover': {
    opacity: 1,
    filter: 'brightness(0.95)'
  }
};

/** Плановые и фактические полосы календаря — плавный сдвиг при обновлении расписания. */
export const calendarBlockLayoutTransitionSx = {
  transition: (theme) =>
    createMuiTransition(
      theme,
      ['left', 'width', 'top', 'height', 'opacity', 'filter', 'box-shadow', 'background-color'],
      {
        duration: theme.transitions.duration.standard,
        easing: theme.transitions.easing.easeInOut
      }
    ),
  '@media (prefers-reduced-motion: reduce)': {
    transition: (theme) =>
      createMuiTransition(theme, ['opacity', 'filter', 'box-shadow', 'background-color'], {
        duration: theme.transitions.duration.shorter
      })
  },
  '&:hover': {
    opacity: 1,
    filter: 'brightness(0.95)'
  }
};

export const positionLeftTransitionSx = {
  transition: (theme) =>
    createMuiTransition(theme, 'left', {
      duration: theme.transitions.duration.standard,
      easing: theme.transitions.easing.sharp
    })
};

export const iconButtonTintTransitionSx = {
  transition: (theme) => createMuiTransition(theme, 'background-color')
};
