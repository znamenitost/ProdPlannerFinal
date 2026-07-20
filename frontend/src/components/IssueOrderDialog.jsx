import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  TextField,
  Typography
} from '@mui/material';
import { AssignmentTurnedIn } from '@mui/icons-material';
import AppDialogTitle from './ui/AppDialogTitle';
import { issuePickupOrder, lookupPickupOrder } from '../services/api';

function statusChipColor(kind) {
  if (kind === 'ready') return 'success';
  if (kind === 'inProgress') return 'warning';
  if (kind === 'pickedUp') return 'default';
  return 'default';
}

export default function IssueOrderDialog({ open, onClose, onIssued }) {
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setOrder(null);
    setError('');
    setLookingUp(false);
    setIssuing(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const busy = lookingUp || issuing;

  const handleLookup = async () => {
    const trimmed = code.trim();
    if (!trimmed || busy) return;

    setLookingUp(true);
    setError('');
    setOrder(null);
    try {
      const result = await lookupPickupOrder(trimmed);
      setOrder(result);
      setCode(result.pickupCode || trimmed);
    } catch (err) {
      setError(err?.message || 'Заказ с таким кодом не найден');
    } finally {
      setLookingUp(false);
    }
  };

  const handleIssue = async () => {
    if (!order?.taskId || !order.canIssue || busy) return;

    setIssuing(true);
    setError('');
    try {
      await issuePickupOrder(order.taskId);
      onIssued?.(order);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось отметить заказ выданным');
      setIssuing(false);
    }
  };

  const handleCodeKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleLookup();
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle onClose={onClose} closeDisabled={busy}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <AssignmentTurnedIn color="primary" fontSize="small" />
          Выдать заказ
        </Box>
      </AppDialogTitle>
      <Divider />
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
        <TextField
          inputRef={inputRef}
          label="Код получения"
          placeholder="А42"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
            if (order) setOrder(null);
          }}
          onKeyDown={handleCodeKeyDown}
          disabled={busy}
          fullWidth
          autoComplete="off"
          slotProps={{
            htmlInput: {
              'aria-label': 'Код получения',
              maxLength: 8,
              style: {
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700,
                fontSize: '1.25rem'
              }
            }
          }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: order || error ? 2 : 0 }}>
          <Button
            variant="outlined"
            onClick={() => void handleLookup()}
            disabled={busy || !code.trim()}
          >
            {lookingUp ? <CircularProgress size={20} /> : 'Найти'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: order ? 2 : 0 }}>
            {error}
          </Alert>
        )}

        {order && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover'
            }}
          >
            <Typography
              variant="h3"
              sx={{
                textAlign: 'center',
                letterSpacing: '0.1em',
                fontWeight: 700,
                fontSize: { xs: '2rem', sm: '2.4rem' },
                lineHeight: 1.1
              }}
            >
              {order.pickupCode || '—'}
            </Typography>

            {order.customerName ? (
              <Typography variant="subtitle1" sx={{ textAlign: 'center', fontWeight: 600 }}>
                {order.customerName}
              </Typography>
            ) : null}

            <Typography variant="body1" sx={{ textAlign: 'center' }}>
              {order.fileName || '—'}
            </Typography>

            {order.primaryComment ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', whiteSpace: 'pre-wrap' }}
              >
                {order.primaryComment}
              </Typography>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
              >
                Первичный комментарий не указан
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
              <Chip
                label={order.status}
                color={statusChipColor(order.statusKind)}
                variant={order.statusKind === 'queued' ? 'outlined' : 'filled'}
              />
            </Box>

            {!order.canIssue && order.statusKind !== 'pickedUp' && (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                Заказ ещё не готов к выдаче
              </Alert>
            )}
            {order.statusKind === 'pickedUp' && (
              <Alert severity="info" sx={{ mt: 0.5 }}>
                Этот заказ уже отмечен как выданный
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => void handleIssue()}
          disabled={busy || !order?.canIssue}
        >
          {issuing ? <CircularProgress size={20} color="inherit" /> : 'ВЫДАН'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
