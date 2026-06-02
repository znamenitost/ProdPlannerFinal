import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

const UiFeedbackContext = createContext(null);

const snackbarAlertSx = (severity) => ({
  width: '100%',
  color: (theme) => theme.palette.common.white,
  bgcolor: (theme) => theme.palette.grey[700],
  border: (theme) => `1px solid ${alpha(theme.palette[severity]?.main || theme.palette.info.main, 0.7)}`,
  borderLeft: (theme) => `5px solid ${theme.palette[severity]?.main || theme.palette.info.main}`,
  boxShadow: (theme) => `0 12px 32px ${alpha(theme.palette.grey[700], 0.32)}`,
  '& .MuiAlert-icon': {
    color: (theme) => theme.palette[severity]?.main || theme.palette.info.main,
  },
  '& .MuiAlert-action': {
    color: 'inherit',
  },
});

const defaultConfirmState = {
  open: false,
  title: 'Подтверждение',
  message: '',
  confirmLabel: 'Подтвердить',
  cancelLabel: 'Отмена',
  confirmColor: 'primary',
  input: null,
};

export function UiFeedbackProvider({ children }) {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });
  const [confirmState, setConfirmState] = useState(defaultConfirmState);
  const [confirmInputValue, setConfirmInputValue] = useState('');
  const confirmResolverRef = useRef(null);
  const confirmOpenRef = useRef(false);

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const showSuccess = useCallback((message) => showSnackbar(message, 'success'), [showSnackbar]);
  const showError = useCallback((message) => showSnackbar(message, 'error'), [showSnackbar]);
  const showWarning = useCallback((message) => showSnackbar(message, 'warning'), [showSnackbar]);
  const showInfo = useCallback((message) => showSnackbar(message, 'info'), [showSnackbar]);

  const confirm = useCallback((options = {}) => {
    if (confirmOpenRef.current) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      confirmOpenRef.current = true;
      confirmResolverRef.current = resolve;
      setConfirmInputValue('');
      setConfirmState({
        open: true,
        title: options.title ?? 'Подтверждение',
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? 'Подтвердить',
        cancelLabel: options.cancelLabel ?? 'Отмена',
        confirmColor: options.confirmColor ?? 'primary',
        input: options.input ?? null,
      });
    });
  }, []);

  const promptInput = useCallback((options = {}) => {
    return confirm({
      ...options,
      input: {
        label: options.inputLabel ?? 'Значение',
        type: options.inputType ?? 'text',
        required: options.inputRequired ?? false,
      },
    });
  }, [confirm]);

  const resolveConfirm = useCallback((confirmed) => {
    if (confirmed && confirmState.input?.required && !confirmInputValue.trim()) return;

    setConfirmState((prev) => ({ ...prev, open: false }));
    confirmResolverRef.current?.(confirmed && confirmState.input ? confirmInputValue : confirmed);
    confirmResolverRef.current = null;
    confirmOpenRef.current = false;
  }, [confirmInputValue, confirmState.input]);

  const handleSnackbarClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const value = {
    showSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    confirm,
    promptInput,
  };

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={snackbarAlertSx(snackbar.severity)}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={confirmState.open}
        onClose={() => resolveConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{confirmState.title}</DialogTitle>
        {(confirmState.message || confirmState.input) && (
          <DialogContent>
            {confirmState.message && <DialogContentText>{confirmState.message}</DialogContentText>}
            {confirmState.input && (
              <TextField
                autoFocus
                fullWidth
                margin="dense"
                label={confirmState.input.label}
                type={confirmState.input.type}
                value={confirmInputValue}
                required={confirmState.input.required}
                error={confirmState.input.required && !confirmInputValue.trim()}
                onChange={(event) => setConfirmInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') resolveConfirm(true);
                }}
              />
            )}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => resolveConfirm(false)}>{confirmState.cancelLabel}</Button>
          <Button
            variant="contained"
            color={confirmState.confirmColor}
            onClick={() => resolveConfirm(true)}
          >
            {confirmState.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const context = useContext(UiFeedbackContext);
  if (!context) {
    throw new Error('useUiFeedback must be used within UiFeedbackProvider');
  }
  return context;
}
