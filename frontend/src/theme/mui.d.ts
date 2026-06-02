import '@mui/material/IconButton';
import '@mui/material/Paper';

declare module '@mui/material/IconButton' {
  interface IconButtonPropsVariantOverrides {
    soft: true;
  }
}

declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides {
    section: true;
  }
}
