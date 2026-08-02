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
import useAuth from '../hooks/useAuth';
import { issueAllReadyPickupOrders, issuePickupOrder } from '../services/api';
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
  const [issuingAll, setIssuingAll] = useState(false);
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

  const issuableOrders = useMemo(
    () => (data?.orders || []).filter((o) => o.taskId),
    [data]
  );
  const issuableCount = issuableOrders.length;
  const readyCount = useMemo(
    () => (data?.orders || []).filter((o) => o.statusKind === 'ready').length,
    [data]
  );
  const totalCount = data?.orders?.length ?? 0;
  const showIssueControls = !authChecking && isAdmin;
  const issueBusy = Boolean(issuingTaskId) || issuingAll;

  const handleIssue = async (order) => {
    if (!isAdmin || !order?.taskId || issueBusy) return;
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

  const handleIssueAll = async () => {
    const anchorId = issuableOrders[0]?.taskId;
    if (!isAdmin || !anchorId || issuableCount < 2 || issueBusy) return;
    setIssuingAll(true);
    setIssueError('');
    try {
      await issueAllReadyPickupOrders(anchorId);
      await load();
    } catch (err) {
      setIssueError(err?.message || 'Не удалось выдать все заказы');
    } finally {
      setIssuingAll(false);
    }
  };

  return (
    <ParallaxPage className="login-parallax-page--scrollable">
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

                {showIssueControls && issuableCount > 1 && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 2.5
                    }}
                  >
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => void handleIssueAll()}
                      disabled={issueBusy}
                    >
                      {issuingAll ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        `Выдать все (${issuableCount})`
                      )}
                    </Button>
                  </Box>
                )}

                {totalCount > 0 && (
                  <Alert
                    severity="error"
                    variant="filled"
                    sx={{
                      mb: 2.5,
                      alignItems: 'flex-start',
                      '& .MuiAlert-message': {
                        width: '100%',
                        fontSize: { xs: '1.05rem', sm: '1.15rem' },
                        fontWeight: 700,
                        lineHeight: 1.4
                      },
                      '& .MuiAlert-icon': {
                        fontSize: '1.75rem',
                        mt: 0.15
                      }
                    }}
                  >
                    Если заказ забирает курьер — сообщите ему номер получения.
                  </Alert>
                )}

                {totalCount > 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', mb: 2, lineHeight: 1.55 }}
                  >
                    Назовите номер получения на стойке выдачи.
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
                      const canIssue = showIssueControls && order.taskId;
                      const busy = issuingTaskId === order.taskId;

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
                          {canIssue && (
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                              <Button
                                variant="contained"
                                color="error"
                                onClick={() => void handleIssue(order)}
                                disabled={issueBusy}
                              >
                                {busy ? (
                                  <CircularProgress size={20} color="inherit" />
                                ) : (
                                  'Выдать'
                                )}
                              </Button>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
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
