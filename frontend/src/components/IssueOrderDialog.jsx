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
import {
  issueAllReadyPickupOrders,
  issuePickupOrder,
  lookupPickupOrder
} from '../services/api';

function statusChipColor(kind) {
  if (kind === 'ready') return 'success';
  if (kind === 'inProgress') return 'warning';
  if (kind === 'pickedUp') return 'default';
  return 'default';
}

function isMatchedCode(orderCode, matchedCode) {
  const a = String(orderCode || '').trim();
  const b = String(matchedCode || '').trim();
  if (!a || !b) return false;
  return a.localeCompare(b, 'ru', { sensitivity: 'accent' }) === 0;
}

export default function IssueOrderDialog({ open, onClose, onIssued }) {
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState(null);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [issuingTaskId, setIssuingTaskId] = useState(null);
  const [issuingAll, setIssuingAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setLookup(null);
    setError('');
    setLookingUp(false);
    setIssuingTaskId(null);
    setIssuingAll(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const orders = lookup?.orders || [];
  const matchedCode = lookup?.matchedPickupCode || '';
  const busy = lookingUp || Boolean(issuingTaskId) || issuingAll;
  const canIssueAll = orders.length > 1;

  const refreshLookup = async (pickupCode) => {
    const result = await lookupPickupOrder(pickupCode);
    setLookup(result);
    setCode(result.matchedPickupCode || pickupCode);
    return result;
  };

  const handleLookup = async () => {
    const trimmed = code.trim();
    if (!trimmed || busy) return;

    setLookingUp(true);
    setError('');
    setLookup(null);
    try {
      await refreshLookup(trimmed);
    } catch (err) {
      setError(err?.message || 'Заказ с таким кодом не найден');
    } finally {
      setLookingUp(false);
    }
  };

  const handleIssue = async (order) => {
    if (!order?.taskId || !order.canIssue || busy) return;

    setIssuingTaskId(order.taskId);
    setError('');
    try {
      await issuePickupOrder(order.taskId);
      onIssued?.({ order, mode: 'single' });

      const next = await refreshLookup(matchedCode || code.trim() || order.pickupCode);
      if (!(next?.orders || []).length) {
        onClose?.();
      }
    } catch (err) {
      setError(err?.message || 'Не удалось отметить заказ выданным');
    } finally {
      setIssuingTaskId(null);
    }
  };

  const handleIssueAll = async () => {
    const anchorId = orders[0]?.taskId;
    if (!anchorId || !canIssueAll || busy) return;

    setIssuingAll(true);
    setError('');
    try {
      const result = await issueAllReadyPickupOrders(anchorId);
      onIssued?.({
        order: orders[0],
        mode: 'all',
        result
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось выдать все заказы');
      setIssuingAll(false);
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
            if (lookup) setLookup(null);
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

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: lookup || error ? 2 : 0 }}>
          <Button
            variant="outlined"
            onClick={() => void handleLookup()}
            disabled={busy || !code.trim()}
          >
            {lookingUp ? <CircularProgress size={20} /> : 'Найти'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: lookup ? 2 : 0 }}>
            {error}
          </Alert>
        )}

        {lookup && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {lookup.customerName ? (
              <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 700 }}>
                {lookup.customerName}
              </Typography>
            ) : null}

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center' }}
            >
              {orders.length === 0
                ? 'Нет активных заказов к выдаче'
                : `Заказов к выдаче: ${orders.length}`}
            </Typography>

            {orders.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  maxHeight: 360,
                  overflowY: 'auto'
                }}
              >
                {orders.map((order, index) => {
                  const focused = isMatchedCode(order.pickupCode, matchedCode);
                  const rowBusy = issuingTaskId === order.taskId;
                  return (
                    <Box
                      key={`${order.taskId}-${order.pickupCode || index}`}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        outline: focused ? '2px solid' : 'none',
                        outlineColor: 'primary.main',
                        outlineOffset: 1
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          textAlign: 'center',
                          letterSpacing: '0.08em',
                          fontWeight: 700,
                          mb: 0.5
                        }}
                      >
                        {order.pickupCode || '—'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ textAlign: 'center', fontWeight: 600, mb: 1 }}
                      >
                        {order.title || '—'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                        <Chip
                          label={order.status}
                          color={statusChipColor(order.statusKind)}
                          size="small"
                          variant={order.statusKind === 'queued' ? 'outlined' : 'filled'}
                        />
                      </Box>
                      {order.canIssue && order.statusKind !== 'ready' && (
                        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                          Не «Готово» — после выдачи будет «?»
                        </Alert>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => void handleIssue(order)}
                          disabled={busy || !order.canIssue}
                        >
                          {rowBusy ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            'Выдать'
                          )}
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          pb: 2,
          flexWrap: 'wrap',
          gap: 1,
          justifyContent: 'flex-end'
        }}
      >
        <Button onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleIssueAll()}
          disabled={busy || !canIssueAll}
        >
          {issuingAll ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            `Выдать все${orders.length > 1 ? ` (${orders.length})` : ''}`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
