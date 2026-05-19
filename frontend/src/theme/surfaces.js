import { alpha } from '@mui/material/styles';

export const pageShellSx = {
  minHeight: '100vh',
  py: { xs: 2, md: 3 },
  px: { xs: 1, sm: 0 }
};

export const glassPaperSx = {
  p: { xs: 2, md: 3 },
  borderRadius: 1,
  bgcolor: 'background.paper',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)'
};

export const glassCardSx = {
  borderRadius: 1,
  bgcolor: alpha('#ffffff', 0.55),
  border: `1px solid ${alpha('#ffffff', 0.8)}`,
  transition: 'box-shadow 0.2s, transform 0.2s',
  '&:hover': {
    boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
    transform: 'translateY(-1px)'
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
    bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.18)
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
  bgcolor: alpha('#F1F5F9', 0.5),
  '& td': { borderBottom: `1px solid ${alpha('#64748B', 0.08)}` },
  '&:hover': { bgcolor: alpha('#E2E8F0', 0.6) }
};
