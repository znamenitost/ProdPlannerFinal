/**
 * Pastel design tokens — single source for theme, surfaces, and calendar.
 * Light, clean, professional; low saturation.
 */
export const tokens = {
  neutral: {
    50: '#FAFBFD',
    100: '#F4F6FA',
    200: '#E8ECF2',
    300: '#D5DCE6',
    400: '#9AA5B5',
    500: '#6B7585',
    600: '#4A5260',
    700: '#3D4451'
  },
  primary: { main: '#8FAEC9', light: '#B8D0E4', dark: '#6E92B3', contrastText: '#FFFFFF' },
  secondary: { main: '#B0BBC8', light: '#D2DAE3', dark: '#8A96A6', contrastText: '#FFFFFF' },
  success: { main: '#8FB9A8', light: '#B8D4C8', dark: '#6F9A88', contrastText: '#FFFFFF' },
  warning: { main: '#E2C89A', light: '#F2E2C4', dark: '#C9A875', contrastText: '#4A5260' },
  error: { main: '#D9A8A8', light: '#EBC8C8', dark: '#C08888', contrastText: '#FFFFFF' },
  info: { main: '#9DBED4', light: '#C2D8E8', dark: '#7BA3BE', contrastText: '#FFFFFF' },
  /** Task block hues (calendar) — muted blue family */
  work: ['#9BB5CE', '#A8C0D6', '#B5CBDE', '#8FAEC9', '#7E9FBA', '#9AAEC4'],
  workDone: '#A8C4B4',
  /** Плановый блок «Согласование» в календаре */
  pendingApproval: '#C9B8E0',
  /** Плановый блок «Нет изделий» в календаре */
  noItems: '#E8C9A8',
  lunch: '#F5EDD8',
  track: '#EEF1F6'
};

/** Tooltip / snackbar chrome (soft, not harsh black) */
export const chrome = {
  tooltipBg: '#4A5260',
  tooltipText: '#FAFBFD'
};
