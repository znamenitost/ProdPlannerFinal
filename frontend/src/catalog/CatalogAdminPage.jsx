import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import CatalogShell from './CatalogShell';
import {
  adminCheckBackgroundRemovalHealth,
  adminCreateCategory,
  adminCreateProduct,
  adminFetchTree
} from './adminApi';

const TAB_OPTIONS = [
  { value: 'photo', label: 'Фото' },
  { value: 'colors', label: 'Цвета' },
  { value: 'mockup', label: 'Примерка' }
];

export default function CatalogAdminPage() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productOpen, setProductOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [tabs, setTabs] = useState(['photo']);
  const [catName, setCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [bgCheck, setBgCheck] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setTree(await adminFetchTree());
    } catch (e) {
      setError(e.message || 'Нет доступа к админке');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openCreateProduct = (catId) => {
    setCategoryId(String(catId));
    setName('');
    setTabs(['photo']);
    setProductOpen(true);
  };

  const toggleTab = (value) => {
    setTabs((prev) => {
      if (prev.includes(value)) {
        if (value === 'photo') return prev;
        return prev.filter((t) => t !== value);
      }
      return [...prev, value];
    });
  };

  const submitProduct = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await adminCreateProduct({
        categoryId: Number(categoryId),
        name,
        initialTabs: tabs,
        isPublished: false
      });
      setProductOpen(false);
      window.location.href = `/catalog/admin/products/${created.id}`;
    } catch (e) {
      setError(e.message || 'Не удалось создать товар');
    } finally {
      setSaving(false);
    }
  };

  const submitCategory = async () => {
    setSaving(true);
    setError('');
    try {
      await adminCreateCategory({ name: catName });
      setCategoryOpen(false);
      setCatName('');
      await reload();
    } catch (e) {
      setError(e.message || 'Не удалось создать категорию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CatalogShell title="Изделия · Админка" dense>
      <Stack spacing={2}>
        <Stack
          direction="row"
          useFlexGap
          gap={1}
          sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.15rem', m: 0 }}>
              Изделия
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Категории (брелки, фурнитура, кейкапы…) → товары внутри. Откройте товар, чтобы настроить вкладки и медиа.
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Button
              size="small"
              variant="text"
              disabled={bgCheck?.loading}
              onClick={async () => {
                setBgCheck({ loading: true });
                try {
                  const d = await adminCheckBackgroundRemovalHealth();
                  setBgCheck({ loading: false, data: d });
                } catch (e) {
                  setBgCheck({ loading: false, error: e.message });
                }
              }}
            >
              {bgCheck?.loading ? 'Проверяю IS-Net…' : 'Проверить IS-Net'}
            </Button>
            <Button size="small" variant="outlined" onClick={() => setCategoryOpen(true)}>
              + Категория
            </Button>
          </Stack>
        </Stack>

        {bgCheck && !bgCheck.loading && (
          <Alert severity={bgCheck.error || !bgCheck.data?.reachable ? 'error' : 'success'}>
            {bgCheck.error && `Проверка не выполнена: ${bgCheck.error}`}
            {!bgCheck.error && bgCheck.data?.reachable &&
              `Модель IS-Net загружена (${bgCheck.data.spaceBaseUrl})`}
            {!bgCheck.error && bgCheck.data && !bgCheck.data.reachable &&
              `Модель IS-Net недоступна (${bgCheck.data.spaceBaseUrl}): ` +
              `${bgCheck.data.errorKind || 'ошибка'} — ${bgCheck.data.errorMessage || 'нет деталей'}`}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {!loading && tree && (tree.categories || []).length === 0 && (
          <Alert severity="info" variant="outlined">
            Пока нет категорий. Создайте первую — например «Брелки» или «Фурнитура».
          </Alert>
        )}

        {!loading && tree && (
          <Stack spacing={2}>
            {(tree.categories || []).map((cat) => (
              <Box
                key={cat.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: 'background.paper'
                }}
              >
                <Stack
                  direction="row"
                  sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Категория
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {cat.name}
                    </Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => openCreateProduct(cat.id)}>
                    + Товар
                  </Button>
                </Stack>
                <Stack spacing={1} sx={{ pl: { xs: 0, sm: 1.5 }, borderLeft: { sm: '2px solid' }, borderColor: { sm: 'divider' } }}>
                  {(cat.products || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      В категории пока нет товаров.
                    </Typography>
                  )}
                  {(cat.products || []).map((p) => (
                    <Box
                      key={p.id}
                      component="a"
                      href={`/catalog/admin/products/${p.id}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                        textDecoration: 'none',
                        color: 'text.primary',
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        bgcolor: 'grey.50',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 140 }}>
                        {p.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={p.isPublished ? 'опубликован' : 'черновик'}
                        color={p.isPublished ? 'success' : 'default'}
                        variant="outlined"
                      />
                      {(p.tabTypes || []).map((t) => (
                        <Chip key={t} size="small" label={t} variant="outlined" />
                      ))}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      <Dialog open={productOpen} onClose={() => setProductOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новый товар</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Категория"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              fullWidth
              size="small"
            >
              {(tree?.categories || []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
            <Typography variant="subtitle2">Стартовые вкладки</Typography>
            <Stack direction="row" useFlexGap gap={1} sx={{ flexWrap: 'wrap' }}>
              {TAB_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Switch
                      size="small"
                      checked={tabs.includes(opt.value)}
                      disabled={opt.value === 'photo'}
                      onChange={() => toggleTab(opt.value)}
                    />
                  }
                  label={opt.label}
                />
              ))}
            </Stack>
            <Alert severity="info" variant="outlined">
              Фото обязательно. Цвета и Примерку можно добавить позже в карточке товара.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductOpen(false)}>Отмена</Button>
          <Button variant="contained" disabled={saving || !name.trim()} onClick={submitProduct}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Новая категория</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            Например: Брелки, Фурнитура, Кейкапы
          </Typography>
          <TextField
            label="Название категории"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            fullWidth
            size="small"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryOpen(false)}>Отмена</Button>
          <Button variant="contained" disabled={saving || !catName.trim()} onClick={submitCategory}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    </CatalogShell>
  );
}
