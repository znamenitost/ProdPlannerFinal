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

export const panelHoverSx = {
  transition: (theme) => createMuiTransition(theme, ['box-shadow', 'transform', 'border-color']),
  '@media (prefers-reduced-motion: reduce)': {
    transition: (theme) => createMuiTransition(theme, ['box-shadow', 'border-color'])
  },
  '&:hover': {
    boxShadow: (theme) => `0 8px 28px ${alpha(theme.palette.primary.main, 0.1)}`,
    borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
    transform: 'translateY(-2px)',
    '@media (prefers-reduced-motion: reduce)': {
      transform: 'none'
    }
  }
};

export const cardHoverSx = {
  transition: (theme) => createMuiTransition(theme, 'box-shadow'),
  '&:hover': {
    boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`
  }
};

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
