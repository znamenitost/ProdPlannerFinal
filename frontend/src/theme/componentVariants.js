import { alpha } from '@mui/material/styles';
import { tokens } from './paletteTokens';
import { createMuiTransition } from './motion';

const { neutral } = tokens;

const STAT_CARD_ALPHA = {
  success: { bg: 0.08, border: 0.2 },
  info: { bg: 0.08, border: 0.2 },
  warning: { bg: 0.1, border: 0.25 },
  error: { bg: 0.08, border: 0.22 }
};

export function nestedCardThemeStyles(theme) {
  return {
    borderRadius: theme.spacing(1.5),
    backgroundColor: neutral[50],
    border: `1px solid ${alpha(neutral[200], 0.95)}`,
    transition: createMuiTransition(theme, 'box-shadow'),
    '&:hover': {
      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`
    }
  };
}

export function statCardThemeStyles(theme, color) {
  const paletteColor = theme.palette[color]?.main ?? theme.palette.primary.main;
  const alphaPair = STAT_CARD_ALPHA[color] ?? STAT_CARD_ALPHA.success;
  return {
    backgroundColor: alpha(paletteColor, alphaPair.bg),
    border: `1px solid ${alpha(paletteColor, alphaPair.border)}`
  };
}

export const compactButtonThemeStyles = {
  minWidth: 0,
  px: 1.25,
  py: 0.35,
  fontSize: '0.75rem',
  lineHeight: 1.3,
  borderRadius: 6
};

/** Outlined compact action (ActiveTaskCard, etc.). */
export function compactOutlinedButtonThemeStyles(theme, color = 'primary') {
  const main = theme.palette[color]?.main ?? theme.palette.primary.main;
  return {
    ...compactButtonThemeStyles,
    border: `1px solid ${alpha(main, 0.5)}`,
    color: main,
    backgroundColor: 'transparent',
    '&:hover': {
      borderColor: main,
      backgroundColor: alpha(main, 0.04)
    }
  };
}

export function toastAlertThemeStyles(theme, accentColor = 'info') {
  const main = theme.palette[accentColor]?.main ?? theme.palette.info.main;
  return {
    width: '100%',
    color: theme.palette.common.white,
    backgroundColor: theme.palette.grey[700],
    border: `1px solid ${alpha(main, 0.7)}`,
    borderLeft: `5px solid ${main}`,
    boxShadow: `0 12px 32px ${alpha(theme.palette.grey[700], 0.32)}`,
    '& .MuiAlert-icon': {
      color: main
    },
    '& .MuiAlert-action': {
      color: 'inherit'
    }
  };
}

export const tableTextFieldThemeStyles = {
  minWidth: 72,
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    fontSize: '0.875rem',
    backgroundColor: 'background.paper'
  },
  '& .MuiOutlinedInput-input': {
    py: 0.875,
    px: 1.25
  }
};

export const tableDatePickerSlotSx = {
  width: '100%',
  minWidth: 152,
  '& .MuiPickersInputBase-root': {
    borderRadius: 1,
    fontSize: '0.875rem',
    minHeight: 40,
    minWidth: 152,
    width: '100%',
    backgroundColor: 'background.paper',
    cursor: 'pointer',
    pr: 0.5
  },
  '& .MuiPickersSectionList-root': {
    py: 0.875,
    px: 0.75,
    fontSize: '0.875rem',
    flex: 1,
    minWidth: 0
  },
  '& .MuiIconButton-root': {
    p: 0.75,
    flexShrink: 0
  }
};
