import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Typography
} from '@mui/material';
import ParallaxPage from './ParallaxPage';
import PickupOrderQr, { buildOrderPageUrl } from './PickupOrderQr';
import useAuth from '../hooks/useAuth';
import { issuePickupOrder } from '../services/api';
import './LoginForm.css';

function statusChipColor(kind) {
  if (kind === 'ready') return 'success';
  if (kind === 'inProgress') return 'warning';
  return 'default';
}

function readFocusPickupCode() {
  try {
    return new URLSearchParams(window.location.search).get('c')?.trim() || '';
  } catch {
    return '';
  }
}

export default function CustomerOrderPage({ token }) {
  const { user, authChecking } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const focusCode = useMemo(() => readFocusPickupCode(), []);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [issuingTaskId, setIssuingTaskId] = useState(null);
  const [issueError, setIssueError] = useState('');

  const load = async (signal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/public/customer-orders/${encodeURIComponent(token)}`, {
        signal,
        cache: 'no-store'
      });
      const text = await res.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        throw new Error('Некорректный ответ сервера');
      }
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || 'Ссылка не найдена');
      }
      setData(payload);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Не удалось загрузить заказ');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!focusCode || loading || !data?.orders?.length) return;
    const el = document.getElementById(`pickup-order-${focusCode}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusCode, loading, data]);

  const handleIssue = async (order) => {
    if (!isAdmin || !order?.taskId || order.statusKind !== 'ready' || issuingTaskId) return;
    setIssuingTaskId(order.taskId);
    setIssueError('');
    try {
      await issuePickupOrder(order.taskId);
      await load();
    } catch (err) {
      setIssueError(err?.message || 'Не удалось отметить заказ выданным');
    } finally {
      setIssuingTaskId(null);
    }
  };

  const readyCount = (data?.orders || []).filter((o) => o.statusKind === 'ready').length;
  const totalCount = data?.orders?.length ?? 0;
  const showIssueControls = !authChecking && isAdmin;

  return (
    <ParallaxPage>
      <Container maxWidth="sm" className="login-content">
        <Box className="login-form-shell">
          <Paper variant="section" sx={{ p: { xs: 3, sm: 4 }, width: '100%' }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress aria-label="Загрузка заказа" />
              </Box>
            )}

            {!loading && error && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {error}
              </Alert>
            )}

            {!loading && !error && data && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mb: 0.5 }}
                >
                  Ваш заказ
                </Typography>
                <Typography
                  variant="h2"
                  sx={{ textAlign: 'center', mb: totalCount > 1 ? 1 : 2 }}
                >
                  {data.customerName}
                </Typography>

                {totalCount > 1 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', mb: 2 }}
                  >
                    Готово к выдаче: {readyCount} из {totalCount}
                  </Typography>
                )}

                {issueError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {issueError}
                  </Alert>
                )}

                {totalCount === 0 ? (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ textAlign: 'center', py: 2 }}
                  >
                    Сейчас нет активных заказов
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {data.orders.map((order, index) => {
                      const code = order.pickupCode || '';
                      const isFocused =
                        focusCode &&
                        code &&
                        focusCode.localeCompare(code, 'ru', { sensitivity: 'accent' }) === 0;
                      const canIssue = showIssueControls && order.statusKind === 'ready' && order.taskId;
                      const busy = issuingTaskId === order.taskId;
                      const qrUrl = buildOrderPageUrl(token, code);

                      return (
                        <Box
                          key={`${code}-${order.taskId || index}`}
                          id={code ? `pickup-order-${code}` : undefined}
                          sx={{
                            borderRadius: 2,
                            outline: isFocused ? '2px solid' : 'none',
                            outlineColor: 'primary.main',
                            outlineOffset: 4,
                            py: isFocused ? 0.5 : 0
                          }}
                        >
                          {index > 0 && <Divider sx={{ mb: 2 }} />}
                          <Typography
                            variant="h3"
                            sx={{
                              textAlign: 'center',
                              letterSpacing: '0.08em',
                              fontWeight: 700,
                              mb: 1,
                              fontSize: { xs: '2.4rem', sm: '3rem' },
                              lineHeight: 1.1
                            }}
                          >
                            {code || '—'}
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{ textAlign: 'center', fontWeight: 600, mb: 1 }}
                          >
                            {order.title}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                            <Chip
                              label={order.status}
                              color={statusChipColor(order.statusKind)}
                              variant={order.statusKind === 'queued' ? 'outlined' : 'filled'}
                            />
                          </Box>
                          {code && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: canIssue ? 1.5 : 0 }}>
                              <PickupOrderQr value={qrUrl} size={168} />
                            </Box>
                          )}
                          {canIssue && (
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                              <Button
                                variant="contained"
                                color="success"
                                onClick={() => void handleIssue(order)}
                                disabled={busy || Boolean(issuingTaskId)}
                              >
                                {busy ? <CircularProgress size={20} color="inherit" /> : 'ВЫДАН'}
                              </Button>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {totalCount > 0 && (
                  <Box
                    sx={{
                      mt: 3,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider',
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                      Назовите номер получения на стойке выдачи.
                    </Typography>
                    <Alert severity="warning" sx={{ mt: 1.5, textAlign: 'left' }}>
                      Если заказ забирает курьер — заранее сообщите ему этот номер,
                      без него заказ не выдадут.
                    </Alert>
                  </Box>
                )}
              </>
            )}
          </Paper>
        </Box>
      </Container>
    </ParallaxPage>
  );
}
