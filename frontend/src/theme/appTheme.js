import { createTheme, alpha } from '@mui/material/styles';
import { tokens, chrome } from './paletteTokens';
import { createMuiTransition, sectionPaperThemeStyles } from './motion';
import {
  compactButtonThemeStyles,
  compactOutlinedButtonThemeStyles,
  nestedCardThemeStyles,
  statCardThemeStyles,
  tableDatePickerSlotSx,
  toastAlertThemeStyles
} from './componentVariants';

const { neutral, primary, secondary, success, warning, error, info } = tokens;

const borderSubtle = alpha(neutral[300], 0.98);
const shadowSoft = `0 4px 24px ${alpha(neutral[600], 0.085)}`;

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
      paper: neutral[50]
    },
    text: {
      primary: neutral[700],
      secondary: neutral[600]
    },
    divider: alpha(neutral[300], 0.92),
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
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    `0 1px 2px ${alpha(neutral[600], 0.055)}`,
    `0 2px 8px ${alpha(neutral[600], 0.07)}`,
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
          boxShadow: shadowSoft,
          borderRadius: 10
        }
      },
      variants: [
        {
          props: { variant: 'section' },
          style: ({ theme }) => sectionPaperThemeStyles(theme)
        }
      ]
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          border: `1px solid ${borderSubtle}`,
          boxShadow: `0 2px 12px ${alpha(neutral[600], 0.055)}`,
          transition: createMuiTransition(theme, 'box-shadow')
        })
      },
      variants: [
        { props: { variant: 'nested' }, style: ({ theme }) => nestedCardThemeStyles(theme) },
        { props: { variant: 'statSuccess' }, style: ({ theme }) => statCardThemeStyles(theme, 'success') },
        { props: { variant: 'statInfo' }, style: ({ theme }) => statCardThemeStyles(theme, 'info') },
        { props: { variant: 'statWarning' }, style: ({ theme }) => statCardThemeStyles(theme, 'warning') },
        { props: { variant: 'statError' }, style: ({ theme }) => statCardThemeStyles(theme, 'error') }
      ]
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
          borderColor: alpha(neutral[400], 0.62),
          '&:hover': {
            borderColor: primary.main,
            backgroundColor: alpha(primary.main, 0.04)
          }
        },
        text: {
          '&:hover': { backgroundColor: alpha(primary.main, 0.05) }
        }
      },
      variants: [
        {
          props: { variant: 'compact' },
          style: ({ theme, ownerState }) =>
            compactOutlinedButtonThemeStyles(theme, ownerState.color || 'primary')
        }
      ]
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme, ownerState }) => ({
          borderRadius: 10,
          transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.short,
            easing: theme.transitions.easing.easeInOut
          }),
          ...(ownerState.variant !== 'soft' && {
            '&:hover': { backgroundColor: alpha(primary.main, 0.08) }
          })
        })
      },
      variants: [
        {
          props: { variant: 'soft' },
          style: ({ theme, ownerState }) => {
            const paletteKey =
              ownerState.color && ownerState.color !== 'default' && ownerState.color !== 'inherit'
                ? ownerState.color
                : 'primary';
            const main =
              theme.palette[paletteKey]?.main ?? theme.palette.primary.main;
            return {
              backgroundColor: alpha(main, 0.1),
              color: main,
              transition: createMuiTransition(theme, 'background-color'),
              '&:hover': { backgroundColor: alpha(main, 0.16) }
            };
          }
        }
      ]
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 500,
          borderRadius: 8,
          transition: createMuiTransition(theme, ['background-color', 'border-color', 'box-shadow'])
        }),
        filled: { border: `1px solid ${alpha(neutral[300], 0.68)}` },
        outlined: { borderColor: alpha(neutral[400], 0.58) }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: neutral[50],
            '& fieldset': { borderColor: alpha(neutral[300], 0.98) },
            '&:hover fieldset': { borderColor: alpha(primary.main, 0.55) },
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
          color: neutral[600],
          backgroundColor: neutral[100],
          borderBottom: `1px solid ${alpha(neutral[300], 0.95)}`
        },
        body: {
          fontSize: '0.85rem',
          borderBottom: `1px solid ${alpha(neutral[300], 0.58)}`
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
          borderRadius: 2.5,
          backgroundColor: primary.main
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 48,
          fontWeight: 500,
          color: neutral[600],
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
          borderRadius: 14,
          border: `1px solid ${borderSubtle}`,
          backgroundColor: neutral[50],
          boxShadow: shadowSoft
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: `1px solid ${alpha(neutral[300], 0.72)}` },
        standardSuccess: { backgroundColor: alpha(success.light, 0.45) },
        standardWarning: { backgroundColor: alpha(warning.light, 0.5) },
        standardError: { backgroundColor: alpha(error.light, 0.45) },
        standardInfo: { backgroundColor: alpha(info.light, 0.45) }
      },
      variants: [
        {
          props: { variant: 'toast' },
          style: ({ theme, ownerState }) =>
            toastAlertThemeStyles(theme, ownerState.severity || 'info')
        }
      ]
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          marginTop: 4,
          border: `1px solid ${borderSubtle}`,
          boxShadow: shadowSoft
        }
      }
    },
    MuiPickersTextField: {
      styleOverrides: {
        root: tableDatePickerSlotSx
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
          borderRadius: 10,
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
    MuiChatBox: {
      styleOverrides: {
        root: {
          backgroundColor: neutral[100]
        }
      }
    },
    MuiChatMessageList: {
      styleOverrides: {
        root: {
          backgroundColor: neutral[100]
        }
      }
    },
    MuiChatMessage: {
      styleOverrides: {
        bubble: ({ theme, ownerState }) => {
          const isOwn = ownerState?.isOwnMessage ?? ownerState?.role === 'user';
          if (isOwn) {
            return {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText
            };
          }
          return {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${borderSubtle}`,
            boxShadow: `0 1px 2px ${alpha(neutral[600], 0.045)}`
          };
        }
      }
    },
    MuiSnackbar: {
      styleOverrides: {
        root: { '& .MuiPaper-root': { borderRadius: 10 } }
      }
    }
  }
});

export default appTheme;
