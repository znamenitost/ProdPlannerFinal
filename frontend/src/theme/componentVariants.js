import { alpha } from '@mui/material/styles';
import { tokens } from './paletteTokens';
import { createMuiTransition } from './motion';

const { neutral, primary } = tokens;

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

/** Same radius as appTheme.shape.borderRadius — row TextField + deadline picker. */
export const TABLE_FIELD_BORDER_RADIUS = 10;

/** MUI small outlined control height (8.5px vertical padding × 2 + line). */
export const TABLE_FIELD_CONTROL_HEIGHT = 40;

const tableFieldOutlinedInputSelector =
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root, & .MuiPickersInputBase-root';

const tableFieldOutlinedFieldsetSx = {
  borderRadius: TABLE_FIELD_BORDER_RADIUS,
  borderColor: alpha(neutral[300], 0.9)
};

const tableFieldOutlinedInputSx = {
  borderRadius: TABLE_FIELD_BORDER_RADIUS,
  fontSize: '0.875rem',
  backgroundColor: neutral[50],
  height: TABLE_FIELD_CONTROL_HEIGHT,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  '& fieldset': tableFieldOutlinedFieldsetSx,
  '&:hover fieldset': {
    borderColor: alpha(primary.main, 0.45)
  },
  '&.Mui-focused fieldset, &.MuiPickersOutlinedInput-focused fieldset': {
    borderColor: primary.main
  }
};

const tableFieldControlWrapperSx = {
  m: 0,
  display: 'flex',
  alignItems: 'center'
};

export const tableTextFieldThemeStyles = {
  minWidth: 72,
  ...tableFieldControlWrapperSx,
  [tableFieldOutlinedInputSelector]: tableFieldOutlinedInputSx,
  '& .MuiOutlinedInput-input': {
    padding: '8.5px 14px',
    boxSizing: 'border-box'
  }
};

export const tableDatePickerSlotSx = {
  width: '100%',
  minWidth: 152,
  ...tableFieldControlWrapperSx,
  [tableFieldOutlinedInputSelector]: {
    ...tableFieldOutlinedInputSx,
    minWidth: 152,
    width: '100%',
    cursor: 'pointer',
    pr: 0.5
  },
  '& .MuiPickersOutlinedInput-input': {
    padding: '8.5px 0',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    fontSize: '0.875rem'
  },
  '& .MuiIconButton-root': {
    p: 0.75,
    flexShrink: 0
  }
};
