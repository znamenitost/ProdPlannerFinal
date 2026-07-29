import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { formatMoney } from '../formatMoney';

function clampQty(n) {
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default function PriceCalculator({
  quantity,
  onQuantityChange,
  quote,
  onAddToCart,
  adding
}) {
  const tiers = quote?.tiers || [];
  const [qtyText, setQtyText] = useState(String(quantity));

  useEffect(() => {
    setQtyText(String(quantity));
  }, [quantity]);

  const commitQty = (raw) => {
    const n = clampQty(parseInt(String(raw).replace(/\D/g, ''), 10));
    setQtyText(String(n));
    if (n !== quantity) onQuantityChange(n);
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Количество
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ width: 'fit-content', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            aria-label="Меньше"
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            value={qtyText}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setQtyText(raw);
              if (raw === '') return;
              const n = parseInt(raw, 10);
              if (Number.isFinite(n) && n > 0) onQuantityChange(n);
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => commitQty(qtyText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            inputProps={{
              inputMode: 'numeric',
              'aria-label': 'Количество',
              style: { textAlign: 'center', paddingLeft: 8, paddingRight: 8 }
            }}
            sx={{
              width: 72,
              '& .MuiInputBase-root': { height: 36 }
            }}
          />
          <IconButton
            size="small"
            onClick={() => onQuantityChange(quantity + 1)}
            aria-label="Больше"
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {tiers.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Цена от количества
          </Typography>
          <Stack spacing={0.5}>
            {tiers.map((t) => {
              const active =
                quantity >= t.minQty && (t.maxQty == null || quantity <= t.maxQty);
              return (
                <Box
                  key={`${t.minQty}-${t.maxQty ?? 'inf'}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: active ? 'primary.light' : 'action.hover',
                    typography: 'body2',
                    color: active ? 'primary.dark' : 'text.secondary',
                    fontWeight: active ? 600 : 400
                  }}
                >
                  <span>
                    {t.maxQty == null ? `от ${t.minQty}` : `${t.minQty}–${t.maxQty}`} шт
                  </span>
                  <span>{formatMoney(t.pricePerUnit)} / шт</span>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ m: 0 }}>
          Итого {quote ? formatMoney(quote.lineTotal) : '—'}
        </Typography>
      </Box>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={onAddToCart}
        disabled={adding || !quote}
      >
        В корзину
      </Button>
    </Stack>
  );
}
