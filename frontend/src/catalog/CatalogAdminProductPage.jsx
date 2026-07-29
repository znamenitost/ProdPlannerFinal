import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CatalogShell from './CatalogShell';
import { MEDIA_HINTS } from './mediaHints';
import {
  adminAddTab,
  adminFetchProduct,
  adminRemoveTab,
  adminReplaceTiers,
  adminReplaceVariants,
  adminSetPhoto,
  adminUpdateProduct,
  adminUpload,
  adminUpsertZone
} from './adminApi';

function MediaHint({ kind }) {
  const h = MEDIA_HINTS[kind];
  if (!h) return null;
  return (
    <Alert severity="info" variant="outlined" sx={{ py: 0.75 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        {h.title}
      </Typography>
      <Typography variant="caption" component="div" color="text.secondary">
        Формат: {h.formats}. Вес: {h.size}. Размер: {h.dimensions}.
      </Typography>
      <Typography variant="caption" component="div" color="text.secondary">
        {h.tip}
      </Typography>
    </Alert>
  );
}

function UploadButton({ label, kind = 'image', onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const res = await adminUpload(file, kind);
      onUploaded?.(res);
    } catch (e) {
      setErr(e.message || 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={0.5}>
      <Button component="label" size="small" variant="outlined" disabled={busy}>
        {busy ? 'Загрузка…' : label}
        <input
          hidden
          type="file"
          accept={kind === 'template' ? '.cdr,.pdf,.svg,.zip' : 'image/*,.svg'}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </Button>
      {err && (
        <Typography variant="caption" color="error">
          {err}
        </Typography>
      )}
    </Stack>
  );
}

export default function CatalogAdminProductPage({ productId }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);
  const [photoUrl, setPhotoUrl] = useState('');
  const [variants, setVariants] = useState([]);
  const [tiers, setTiers] = useState([{ minQty: 1, maxQty: null, pricePerUnit: 0, sortOrder: 1 }]);
  const [zone, setZone] = useState({
    name: 'Лицевая сторона',
    baseImageUrl: '',
    maskUrl: '',
    templateUrl: '',
    methodPreset: 'uv',
    specsJson: '[]'
  });

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetchProduct(productId);
      setProduct(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setPublished(!!data.isPublished);
      setPhotoUrl(data.images?.find((i) => i.kind === 'photo')?.url || '');
      setVariants(
        (data.variants || []).map((v, i) => ({
          colorName: v.colorName,
          colorHex: v.colorHex,
          sku: v.sku,
          previewImageUrl: v.previewImageUrl || '',
          isAvailable: v.isAvailable,
          sortOrder: i + 1
        }))
      );
      setTiers(
        (data.priceTiers || []).map((t, i) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          pricePerUnit: t.pricePerUnit,
          sortOrder: i + 1
        }))
      );
      const z = data.artworkZones?.[0];
      if (z) {
        setZone({
          name: z.name || 'Лицевая сторона',
          baseImageUrl: z.baseImageUrl || '',
          maskUrl: z.maskUrl || '',
          templateUrl: z.templateUrl || '',
          methodPreset: z.methodPreset || 'uv',
          specsJson: JSON.stringify(z.specs || [], null, 0)
        });
      }
    } catch (e) {
      setError(e.message || 'Не удалось загрузить товар');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [productId]);

  const tabTypes = useMemo(
    () => new Set((product?.tabs || []).map((t) => t.type)),
    [product]
  );

  const saveMeta = async () => {
    setError('');
    try {
      await adminUpdateProduct(productId, {
        name,
        description,
        isPublished: published,
        sortOrder: product?.sortOrder || 1,
        categoryId: null
      });
      setFlash('Сохранено');
      setTimeout(() => setFlash(''), 1500);
      await reload();
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    }
  };

  const savePhoto = async (url) => {
    const next = url || photoUrl;
    setPhotoUrl(next);
    await adminSetPhoto(productId, next);
    await reload();
  };

  const saveVariants = async () => {
    await adminReplaceVariants(productId, variants);
    await reload();
    setFlash('Цвета сохранены');
    setTimeout(() => setFlash(''), 1500);
  };

  const saveTiers = async () => {
    await adminReplaceTiers(productId, tiers);
    await reload();
    setFlash('Цены сохранены');
    setTimeout(() => setFlash(''), 1500);
  };

  const saveZone = async () => {
    await adminUpsertZone(productId, zone);
    await reload();
    setFlash('Примерка сохранена');
    setTimeout(() => setFlash(''), 1500);
  };

  const addTab = async (type) => {
    await adminAddTab(productId, { type });
    await reload();
  };

  const removeTab = async (tabId) => {
    await adminRemoveTab(productId, tabId);
    await reload();
  };

  if (loading) {
    return (
      <CatalogShell title="Изделия · Админка" dense>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      </CatalogShell>
    );
  }

  return (
    <CatalogShell title="Изделия · Админка" dense>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <Button href="/catalog/admin" size="small" sx={{ alignSelf: 'flex-start' }}>
          ← К дереву каталога
        </Button>

        {error && <Alert severity="error">{error}</Alert>}
        {flash && <Alert severity="success">{flash}</Alert>}

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Карточка
          </Typography>
          <Stack spacing={1.5}>
            <TextField size="small" label="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField
              size="small"
              label="Описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
            />
            <TextField
              select
              size="small"
              label="Статус"
              value={published ? '1' : '0'}
              onChange={(e) => setPublished(e.target.value === '1')}
            >
              <MenuItem value="1">Опубликован</MenuItem>
              <MenuItem value="0">Черновик</MenuItem>
            </TextField>
            <Button variant="contained" size="small" onClick={saveMeta} sx={{ alignSelf: 'flex-start' }}>
              Сохранить карточку
            </Button>
            {product?.slug && (
              <Typography variant="caption" color="text.secondary">
                Витрина: <a href={`/catalog/${product.slug}`}>/catalog/{product.slug}</a>
              </Typography>
            )}
          </Stack>
        </Box>

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Вкладки
          </Typography>
          <Stack direction="row" useFlexGap gap={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
            {(product?.tabs || []).map((t) => (
              <Chip
                key={t.id}
                label={t.label || t.type}
                onDelete={t.type === 'photo' ? undefined : () => removeTab(t.id)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>
          <Stack direction="row" useFlexGap gap={1} sx={{ flexWrap: 'wrap' }}>
            {!tabTypes.has('colors') && (
              <Button size="small" variant="outlined" onClick={() => addTab('colors')}>
                + Цвета
              </Button>
            )}
            {!tabTypes.has('mockup') && (
              <Button size="small" variant="outlined" onClick={() => addTab('mockup')}>
                + Примерка
              </Button>
            )}
          </Stack>
        </Box>

        {tabTypes.has('photo') && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Вкладка «Фото»
            </Typography>
            <Stack spacing={1.5}>
              <MediaHint kind="photo" />
              {photoUrl && (
                <Box
                  component="img"
                  src={photoUrl}
                  alt=""
                  sx={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 1, bgcolor: 'grey.50' }}
                />
              )}
              <TextField
                size="small"
                label="URL фото"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <UploadButton
                  label="Загрузить файл"
                  onUploaded={(r) => {
                    setPhotoUrl(r.url);
                    savePhoto(r.url);
                  }}
                />
                <Button size="small" variant="contained" onClick={() => savePhoto()}>
                  Сохранить URL
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {tabTypes.has('colors') && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Вкладка «Цвета»
            </Typography>
            <Stack spacing={1.5}>
              <MediaHint kind="colorPreview" />
              {variants.map((v, idx) => (
                <Stack key={idx} spacing={1} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5 }}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Имя"
                      value={v.colorName}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx] = { ...v, colorName: e.target.value };
                        setVariants(next);
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Hex"
                      value={v.colorHex}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx] = { ...v, colorHex: e.target.value };
                        setVariants(next);
                      }}
                      sx={{ width: 120 }}
                    />
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: v.colorHex || '#ccc',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="URL превью"
                    value={v.previewImageUrl}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = { ...v, previewImageUrl: e.target.value };
                      setVariants(next);
                    }}
                  />
                  <UploadButton
                    label="Загрузить превью цвета"
                    onUploaded={(r) => {
                      const next = [...variants];
                      next[idx] = { ...v, previewImageUrl: r.url };
                      setVariants(next);
                    }}
                  />
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                  >
                    Удалить цвет
                  </Button>
                </Stack>
              ))}
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  setVariants([
                    ...variants,
                    {
                      colorName: 'Новый',
                      colorHex: '#8FAEC9',
                      sku: '',
                      previewImageUrl: '',
                      isAvailable: true,
                      sortOrder: variants.length + 1
                    }
                  ])
                }
              >
                + Цвет
              </Button>
              <Button size="small" variant="contained" onClick={saveVariants}>
                Сохранить цвета
              </Button>
            </Stack>
          </Box>
        )}

        {tabTypes.has('mockup') && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Вкладка «Примерка»
            </Typography>
            <Stack spacing={1.5}>
              <MediaHint kind="mockupBase" />
              <TextField
                size="small"
                label="Base URL (опционально)"
                value={zone.baseImageUrl}
                onChange={(e) => setZone({ ...zone, baseImageUrl: e.target.value })}
              />
              <UploadButton
                label="Загрузить базу"
                onUploaded={(r) => setZone({ ...zone, baseImageUrl: r.url })}
              />
              <MediaHint kind="mockupMask" />
              <TextField
                size="small"
                label="Mask URL"
                value={zone.maskUrl}
                onChange={(e) => setZone({ ...zone, maskUrl: e.target.value })}
              />
              <UploadButton
                label="Загрузить маску"
                onUploaded={(r) => setZone({ ...zone, maskUrl: r.url })}
              />
              <MediaHint kind="template" />
              <TextField
                size="small"
                label="Template URL (.CDR)"
                value={zone.templateUrl}
                onChange={(e) => setZone({ ...zone, templateUrl: e.target.value })}
              />
              <UploadButton
                label="Загрузить шаблон .CDR"
                kind="template"
                onUploaded={(r) => setZone({ ...zone, templateUrl: r.url })}
              />
              <Button size="small" variant="contained" onClick={saveZone}>
                Сохранить примерку
              </Button>
            </Stack>
          </Box>
        )}

        <Divider />

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Цены
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Один тир = фиксированная цена за штуку. Несколько тиров = скидка от количества.
          </Typography>
          <Stack spacing={1}>
            {tiers.map((t, idx) => (
              <Stack
                key={idx}
                direction="row"
                useFlexGap
                gap={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <TextField
                  size="small"
                  type="number"
                  label="От шт"
                  value={t.minQty}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...t, minQty: Number(e.target.value) };
                    setTiers(next);
                  }}
                  sx={{ width: 100 }}
                  disabled={tiers.length === 1}
                />
                {tiers.length > 1 && (
                  <TextField
                    size="small"
                    type="number"
                    label="До шт"
                    value={t.maxQty ?? ''}
                    placeholder="∞"
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = {
                        ...t,
                        maxQty: e.target.value === '' ? null : Number(e.target.value)
                      };
                      setTiers(next);
                    }}
                    sx={{ width: 100 }}
                  />
                )}
                <TextField
                  size="small"
                  type="number"
                  label={tiers.length === 1 ? 'Цена ₽ / шт' : 'Цена ₽'}
                  value={t.pricePerUnit}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...t, pricePerUnit: Number(e.target.value) };
                    setTiers(next);
                  }}
                  sx={{ width: 130 }}
                />
                {tiers.length > 1 && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}
                  >
                    Удалить
                  </Button>
                )}
              </Stack>
            ))}
            <Stack direction="row" useFlexGap gap={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const last = tiers[tiers.length - 1];
                  const nextMin = (last?.maxQty || last?.minQty || 1) + 1;
                  setTiers([
                    ...tiers.map((t, i) =>
                      i === tiers.length - 1 && t.maxQty == null
                        ? { ...t, maxQty: nextMin - 1 }
                        : t
                    ),
                    {
                      minQty: nextMin,
                      maxQty: null,
                      pricePerUnit: last?.pricePerUnit ?? 0,
                      sortOrder: tiers.length + 1
                    }
                  ]);
                }}
              >
                + Тир
              </Button>
              {tiers.length > 1 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() =>
                    setTiers([
                      {
                        minQty: 1,
                        maxQty: null,
                        pricePerUnit: tiers[0]?.pricePerUnit ?? 0,
                        sortOrder: 1
                      }
                    ])
                  }
                >
                  Одна цена
                </Button>
              )}
              <Button size="small" variant="contained" onClick={saveTiers}>
                Сохранить цены
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </CatalogShell>
  );
}
