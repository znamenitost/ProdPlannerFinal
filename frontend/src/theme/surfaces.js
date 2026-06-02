import { alpha } from '@mui/material/styles';
import { tokens } from './paletteTokens';
const { neutral } = tokens;

/** Full-page background wrapper */
export const pageShellSx = {
  minHeight: '100vh',
  py: { xs: 2, md: 3 },
  px: { xs: 1, sm: 0 }
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

export const childRowSx = {
  bgcolor: alpha(neutral[100], 0.7),
  '& td': { borderBottom: `1px solid ${alpha(neutral[200], 0.9)}` },
  transition: (theme) => theme.transitions.create('background-color', {
    duration: theme.transitions.duration.shorter
  }),
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
  borderRadius: 2.5,
  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
};

export const highlightedTaskRowSx = (theme) => ({
  bgcolor: alpha(theme.palette.primary.light, 0.4),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`,
  borderRadius: 1,
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.shorter
  }),
  '&:hover': { bgcolor: alpha(theme.palette.primary.light, 0.5) }
});

export const overdueTaskRowSx = (theme) => ({
  bgcolor: alpha(theme.palette.error.light, 0.35),
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.shorter
  }),
  '&:hover': { bgcolor: alpha(theme.palette.error.light, 0.45) }
});
