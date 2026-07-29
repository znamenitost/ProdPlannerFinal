import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CardActionArea,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CatalogShell from './CatalogShell';
import { fetchCatalogProducts } from './api';
import { formatMoney } from './formatMoney';

export default function CatalogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchCatalogProducts();
        if (!cancelled) setItems(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Не удалось загрузить каталог');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CatalogShell title="Каталог продукции">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Выберите модель — цвет, тираж и цена на следующей странице.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)'
            },
            gap: 2
          }}
        >
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2.5,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                transition: (t) =>
                  t.transitions.create(['background-color', 'border-color'], {
                    duration: t.transitions.duration.shorter
                  }),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                  borderColor: (t) => alpha(t.palette.primary.main, 0.35)
                }
              }}
            >
              <CardActionArea href={`/catalog/${item.slug}`} sx={{ p: 2 }}>
                <Box
                  component="img"
                  src={item.heroImageUrl}
                  alt={item.name}
                  sx={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    mb: 1.5,
                    display: 'block'
                  }}
                />
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {item.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  от {formatMoney(item.fromPrice)}
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  {(item.colorSwatches || []).slice(0, 6).map((s) => (
                    <Box
                      key={s.id}
                      title={s.colorName}
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: 1,
                        bgcolor: s.colorHex,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  ))}
                </Stack>
              </CardActionArea>
            </Box>
          ))}
        </Box>
      )}
    </CatalogShell>
  );
}
