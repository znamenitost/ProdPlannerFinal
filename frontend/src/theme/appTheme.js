import { createTheme, alpha } from '@mui/material/styles';
import { tokens, chrome } from './paletteTokens';
import { createMuiTransition } from './motion';

const { neutral, primary, secondary, success, warning, error, info } = tokens;

const borderSubtle = alpha(neutral[300], 0.9);
const shadowSoft = `0 4px 24px ${alpha(neutral[600], 0.06)}`;

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary,
    secondary,
    success,
    warning,
    error,
    info,
    grey: {
      50: neutral[50],
      100: neutral[100],
      200: neutral[200],
      300: neutral[300],
      400: neutral[400],
      500: neutral[500],
      600: neutral[600],
      700: neutral[700]
    },
    background: {
      default: neutral[100],
      paper: alpha(neutral[50], 0.96)
    },
    text: {
      primary: neutral[700],
      secondary: neutral[500]
    },
    divider: alpha(neutral[300], 0.85),
    action: {
      hover: alpha(primary.main, 0.05),
      selected: alpha(primary.main, 0.08),
      disabledBackground: alpha(neutral[300], 0.4)
    }
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: neutral[700] },
    h2: { fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.01em', color: neutral[700] },
    h3: { fontSize: '1.05rem', fontWeight: 600, color: neutral[700] },
    subtitle1: { fontSize: '0.95rem', fontWeight: 600 },
    subtitle2: { fontSize: '0.85rem', fontWeight: 600 },
    body1: { fontSize: '0.9rem' },
    body2: { fontSize: '0.85rem' },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' }
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    `0 1px 2px ${alpha(neutral[600], 0.04)}`,
    `0 2px 8px ${alpha(neutral[600], 0.05)}`,
    shadowSoft,
    ...Array(21).fill(shadowSoft)
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: `linear-gradient(165deg, ${neutral[100]} 0%, ${neutral[50]} 45%, ${neutral[100]} 100%)`,
          backgroundAttachment: 'fixed',
          minHeight: '100vh'
        }
      }
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${borderSubtle}`,
          boxShadow: shadowSoft
        }
      }
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          border: `1px solid ${borderSubtle}`,
          boxShadow: `0 2px 12px ${alpha(neutral[600], 0.04)}`,
          transition: createMuiTransition(theme, 'box-shadow')
        })
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          padding: '6px 16px',
          transition: createMuiTransition(theme, [
            'background-color',
            'border-color',
            'box-shadow',
            'color'
          ])
        }),
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: `0 2px 8px ${alpha(primary.main, 0.2)}` }
        },
        outlined: {
          borderColor: alpha(neutral[400], 0.5),
          '&:hover': {
            borderColor: primary.main,
            backgroundColor: alpha(primary.main, 0.04)
          }
        },
        text: {
          '&:hover': { backgroundColor: alpha(primary.main, 0.05) }
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.short,
            easing: theme.transitions.easing.easeInOut
          }),
          '&:hover': { backgroundColor: alpha(primary.main, 0.08) }
        })
      }
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 500,
          borderRadius: 8,
          transition: createMuiTransition(theme, ['background-color', 'border-color', 'box-shadow'])
        }),
        filled: { border: `1px solid ${alpha(neutral[300], 0.5)}` },
        outlined: { borderColor: alpha(neutral[400], 0.45) }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: neutral[50],
            '& fieldset': { borderColor: alpha(neutral[300], 0.9) },
            '&:hover fieldset': { borderColor: alpha(primary.main, 0.45) },
            '&.Mui-focused fieldset': { borderColor: primary.main }
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.8rem',
          color: neutral[500],
          backgroundColor: neutral[100],
          borderBottom: `1px solid ${alpha(neutral[300], 0.8)}`
        },
        body: {
          fontSize: '0.85rem',
          borderBottom: `1px solid ${alpha(neutral[200], 0.9)}`
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          transition: createMuiTransition(theme, 'background-color', {
            duration: theme.transitions.duration.shorter
          }),
          '&:hover': { backgroundColor: alpha(primary.main, 0.03) }
        })
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
          backgroundColor: neutral[50]
        },
        indicator: {
          height: 3,
          borderRadius: 3,
          backgroundColor: primary.main
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 48,
          fontWeight: 500,
          color: neutral[500],
          transition: createMuiTransition(theme, ['color', 'background-color']),
          '&.Mui-selected': {
            fontWeight: 600,
            color: primary.dark
          }
        })
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          transition: createMuiTransition(theme, ['background-color', 'color', 'border-color'])
        })
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: `1px solid ${borderSubtle}`,
          backgroundColor: neutral[50],
          boxShadow: shadowSoft
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${alpha(neutral[300], 0.6)}` },
        standardSuccess: { backgroundColor: alpha(success.light, 0.45) },
        standardWarning: { backgroundColor: alpha(warning.light, 0.5) },
        standardError: { backgroundColor: alpha(error.light, 0.45) },
        standardInfo: { backgroundColor: alpha(info.light, 0.45) }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          padding: '8px 12px',
          backgroundColor: alpha(chrome.tooltipBg, 0.94),
          color: chrome.tooltipText,
          boxShadow: shadowSoft
        }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
          backgroundColor: alpha(neutral[300], 0.5)
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          marginTop: 4,
          minWidth: 200,
          border: `1px solid ${borderSubtle}`,
          boxShadow: shadowSoft
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          margin: '2px 6px',
          padding: '8px 12px',
          transition: createMuiTransition(theme, 'background-color', {
            duration: theme.transitions.duration.shorter
          }),
          '&:hover': { backgroundColor: alpha(primary.main, 0.06) }
        })
      }
    },
    MuiSnackbar: {
      styleOverrides: {
        root: { '& .MuiPaper-root': { borderRadius: 12 } }
      }
    }
  }
});

export default appTheme;
