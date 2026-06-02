import '@mui/material/IconButton';
import '@mui/material/Paper';
import '@mui/material/Button';
import '@mui/material/Card';
import '@mui/material/TextField';
import '@mui/material/Alert';

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

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    compact: true;
  }
}

declare module '@mui/material/Card' {
  interface CardPropsVariantOverrides {
    nested: true;
    statSuccess: true;
    statInfo: true;
    statWarning: true;
    statError: true;
  }
}

declare module '@mui/material/TextField' {
  interface TextFieldPropsVariantOverrides {
    table: true;
  }
}

declare module '@mui/material/Alert' {
  interface AlertPropsVariantOverrides {
    toast: true;
  }
}
