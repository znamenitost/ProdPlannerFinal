import { createTheme, alpha } from '@mui/material/styles';

const primary = {
  main: '#5B8DB8',
  light: '#9BB9D9',
  dark: '#3D6E94',
  contrastText: '#ffffff'
};

const glassBorder = alpha('#ffffff', 0.65);
const glassShadow = `0 8px 32px ${alpha('#5B8DB8', 0.08)}`;

const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary,
    secondary: {
      main: '#94A3B8',
      light: '#CBD5E1',
      dark: '#64748B',
      contrastText: '#ffffff'
    },
    success: {
      main: '#5FA882',
      light: '#8FC4A8',
      dark: '#458A66',
      contrastText: '#ffffff'
    },
    warning: {
      main: '#D4A84A',
      light: '#E8C878',
      dark: '#B08830',
      contrastText: '#1e293b'
    },
    error: {
      main: '#D48989',
      light: '#E8B0B0',
      dark: '#B86B6B',
      contrastText: '#ffffff'
    },
    info: {
      main: '#6BA3C7',
      light: '#9BC4DE',
      dark: '#4A85AD',
      contrastText: '#ffffff'
    },
    background: {
      default: '#E8EEF5',
      paper: alpha('#ffffff', 0.78)
    },
    text: {
      primary: '#334155',
      secondary: '#64748B'
    },
    divider: alpha('#64748B', 0.14),
    action: {
      hover: alpha(primary.main, 0.06),
      selected: alpha(primary.main, 0.1),
      disabledBackground: alpha('#94A3B8', 0.12)
    }
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#334155' },
    h2: { fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.01em', color: '#334155' },
    h3: { fontSize: '1.05rem', fontWeight: 600, color: '#334155' },
    subtitle1: { fontSize: '0.95rem', fontWeight: 600 },
    body1: { fontSize: '0.9rem' },
    body2: { fontSize: '0.85rem' },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' }
  },
  shape: { borderRadius: 6 },
  shadows: [
    'none',
    `0 1px 3px ${alpha('#334155', 0.06)}`,
    `0 2px 8px ${alpha('#5B8DB8', 0.08)}`,
    `0 8px 24px ${alpha('#5B8DB8', 0.1)}`,
    ...Array(21).fill(`0 8px 24px ${alpha('#5B8DB8', 0.1)}`)
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(165deg, #E2EAF2 0%, #F0F4F9 50%, #E8EFF7 100%)',
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
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 6,
          border: `1px solid ${glassBorder}`,
          boxShadow: glassShadow
        }
      }
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(12px)',
          borderRadius: 6,
          border: `1px solid ${alpha('#ffffff', 0.7)}`,
          boxShadow: `0 4px 16px ${alpha('#5B8DB8', 0.06)}`
        }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, padding: '6px 16px' },
        outlined: {
          borderColor: alpha('#64748B', 0.25),
          '&:hover': {
            borderColor: primary.main,
            backgroundColor: alpha(primary.main, 0.04)
          }
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          transition: 'background-color 0.2s, transform 0.15s',
          '&:hover': { transform: 'scale(1.04)' }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 6 }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            backgroundColor: alpha('#ffffff', 0.6)
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.8rem',
          color: '#64748B',
          backgroundColor: alpha('#F1F5F9', 0.85)
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover': { backgroundColor: alpha(primary.main, 0.03) } }
      }
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 3, borderRadius: 3 } }
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 48, '&.Mui-selected': { fontWeight: 600 } }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          backdropFilter: 'blur(20px)',
          backgroundColor: alpha('#ffffff', 0.92)
        }
      }
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          backgroundColor: alpha('#1e293b', 0.92)
        }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 8, backgroundColor: alpha('#94A3B8', 0.2) }
      }
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: 6, marginTop: 4, minWidth: 200 } }
    },
    MuiMenuItem: {
      styleOverrides: { root: { borderRadius: 8, margin: '2px 6px' } }
    }
  }
});

export default appTheme;
