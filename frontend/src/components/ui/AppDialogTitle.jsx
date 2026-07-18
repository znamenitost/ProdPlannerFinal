import { DialogTitle, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * Shared dialog title with an optional top-right close (X) control.
 */
export default function AppDialogTitle({
  children,
  onClose,
  closeDisabled = false,
  sx,
  ...props
}) {
  return (
    <DialogTitle
      {...props}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        pr: onClose ? 6 : undefined,
        px: { xs: 2, sm: 3 },
        pt: 2.5,
        pb: 1.5,
        ...sx
      }}
    >
      {children}
      {onClose ? (
        <IconButton
          aria-label="Закрыть"
          onClick={closeDisabled ? undefined : onClose}
          disabled={closeDisabled}
          size="small"
          sx={(theme) => ({
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500]
          })}
        >
          <Close fontSize="small" />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
}
