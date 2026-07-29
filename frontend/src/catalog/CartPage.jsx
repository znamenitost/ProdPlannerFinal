import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { DeleteOutlined as DeleteOutlineIcon } from '@mui/icons-material';
import CatalogShell from './CatalogShell';
import { checkoutCatalogOrder } from './api';
import {
  clearCart,
  readCart,
  removeCartItem,
  updateCartItemQuantity
} from './cartStorage';
import { formatMoney } from './formatMoney';

export default function CartPage() {
  const [items, setItems] = useState(() => readCart());
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const sync = () => setItems(readCart());
    window.addEventListener('catalog-cart-changed', sync);
    return () => window.removeEventListener('catalog-cart-changed', sync);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, x) => sum + Number(x.unitPrice || 0) * x.quantity, 0),
    [items]
  );

  const submit = async () => {
    setError('');
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await checkoutCatalogOrder({
        customerName,
        phone: phone || null,
        telegram: telegram || null,
        email: email || null,
        comment: comment || null,
        lines: items.map((x) => {
          let mockup = x.mockupTransformJson || null;
          if (mockup) {
            try {
              const parsed = JSON.parse(mockup);
              delete parsed.logoDataUrl;
              mockup = JSON.stringify(parsed);
            } catch {
              /* keep as-is */
            }
          }
          return {
            productId: x.productId,
            variantId: x.variantId,
            quantity: x.quantity,
            mockupTransformJson: mockup,
            logoFileUrl: x.logoFileUrl?.startsWith('data:') ? null : x.logoFileUrl || null
          };
        })
      });
      clearCart();
      setItems([]);
      setSuccess(result);
    } catch (e) {
      setError(e.message || 'Не удалось оформить заказ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CatalogShell title="Корзина">
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Заказ {success.publicNumber} принят. Сумма {formatMoney(success.totalAmount)}.
          Позиции появятся в таблице задач.
        </Alert>
      )}

      {items.length === 0 && !success && (
        <Alert severity="info">
          Корзина пуста.{' '}
          <Button href="/catalog" size="small">
            В каталог
          </Button>
        </Alert>
      )}

      {items.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' },
            gap: 3,
            alignItems: 'start'
          }}
        >
          <Stack spacing={1.5}>
            {items.map((item) => (
              <Paper
                key={`${item.productId}-${item.variantId}`}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2.5 }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Box
                    component="img"
                    src={item.previewImageUrl}
                    alt=""
                    sx={{
                      width: 72,
                      height: 72,
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      bgcolor: 'grey.50'
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} noWrap>
                      {item.productName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.colorName} · {formatMoney(item.unitPrice)} / шт
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        label="Кол-во"
                        value={item.quantity}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                          setItems(
                            updateCartItemQuantity(
                              item.productId,
                              item.variantId,
                              Number.isFinite(n) && n > 0 ? n : 1
                            )
                          );
                        }}
                        sx={{ width: 100 }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {formatMoney(item.unitPrice * item.quantity)}
                      </Typography>
                    </Stack>
                  </Box>
                  <IconButton
                    aria-label="Удалить"
                    onClick={() =>
                      setItems(removeCartItem(item.productId, item.variantId))
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Paper
            variant="outlined"
            sx={{ p: 2.5, borderRadius: 2.5, position: { md: 'sticky' }, top: { md: 72 } }}
          >
            <Typography variant="h2" sx={{ fontSize: '1.15rem', mb: 2 }}>
              Оформление
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Имя или компания"
                required
                size="small"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <TextField
                label="Телефон"
                size="small"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <TextField
                label="Telegram"
                size="small"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
              />
              <TextField
                label="Email"
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Комментарий"
                size="small"
                multiline
                minRows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" fontWeight={600} sx={{ mb: 2 }}>
              Итого {formatMoney(total)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Итоговая цена пересчитывается на сервере по актуальным тиражам.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting || !customerName.trim()}
              onClick={submit}
            >
              {submitting ? 'Отправка…' : 'Запросить расчёт'}
            </Button>
          </Paper>
        </Box>
      )}
    </CatalogShell>
  );
}
