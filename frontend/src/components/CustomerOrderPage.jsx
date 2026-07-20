import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Typography
} from '@mui/material';
import ParallaxPage from './ParallaxPage';
import './LoginForm.css';

function statusChipColor(kind) {
  if (kind === 'ready') return 'success';
  if (kind === 'inProgress') return 'warning';
  return 'default';
}

export default function CustomerOrderPage({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/public/customer-orders/${encodeURIComponent(token)}`, {
          signal: controller.signal,
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
        if (!cancelled) setData(payload);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message || 'Не удалось загрузить заказ');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  const readyCount = (data?.orders || []).filter((o) => o.statusKind === 'ready').length;
  const totalCount = data?.orders?.length ?? 0;

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
                    {data.orders.map((order, index) => (
                      <Box key={`${order.pickupCode}-${index}`}>
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
                          {order.pickupCode || '—'}
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{ textAlign: 'center', fontWeight: 600, mb: 1 }}
                        >
                          {order.title}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Chip
                            label={order.status}
                            color={statusChipColor(order.statusKind)}
                            variant={order.statusKind === 'queued' ? 'outlined' : 'filled'}
                          />
                        </Box>
                      </Box>
                    ))}
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
