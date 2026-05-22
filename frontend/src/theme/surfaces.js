import { alpha } from '@mui/material/styles';
import { tokens } from './paletteTokens';

const { neutral } = tokens;

/** Full-page background wrapper */
export const pageShellSx = {
  minHeight: '100vh',
  py: { xs: 2, md: 3 },
  px: { xs: 1, sm: 0 }
};

/** Section panel */
export const glassPaperSx = {
  p: { xs: 2, md: 3 },
  borderRadius: 3,
  bgcolor: 'background.paper'
};

/** Nested card */
export const glassCardSx = {
  borderRadius: 2,
  bgcolor: neutral[50],
  border: `1px solid ${alpha(neutral[200], 0.95)}`,
  transition: 'box-shadow 0.2s',
  '&:hover': {
    boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`
  }
};

export const sectionHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 1.5,
  mb: 2
};

export const sectionTitleRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1
};

export const softIconButtonSx = (color = 'primary') => ({
  bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1),
  color: `${color}.main`,
  '&:hover': {
    bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.16)
  }
});

export const compactActionButtonSx = {
  minWidth: 0,
  px: 1.25,
  py: 0.35,
  fontSize: '0.75rem',
  lineHeight: 1.3,
  borderRadius: 1.5
};

export const childRowSx = {
  bgcolor: alpha(neutral[100], 0.7),
  '& td': { borderBottom: `1px solid ${alpha(neutral[200], 0.9)}` },
  '&:hover': { bgcolor: alpha(neutral[200], 0.5) }
};

export const draftRowSx = {
  bgcolor: (theme) => alpha(theme.palette.warning.light, 0.55)
};

export const metaPanelSx = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  bgcolor: (theme) => alpha(theme.palette.primary.light, 0.35),
  px: 2,
  py: 1,
  borderRadius: 3,
  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
};

export const highlightedTaskRowSx = (theme) => ({
  bgcolor: alpha(theme.palette.primary.light, 0.4),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`,
  borderRadius: 1,
  '&:hover': { bgcolor: alpha(theme.palette.primary.light, 0.5) }
});

export const overdueTaskRowSx = (theme) => ({
  bgcolor: alpha(theme.palette.error.light, 0.35),
  '&:hover': { bgcolor: alpha(theme.palette.error.light, 0.45) }
});
