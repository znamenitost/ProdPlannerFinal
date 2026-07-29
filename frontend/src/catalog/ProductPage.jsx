import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import CatalogShell from './CatalogShell';
import ColorSwatches from './components/ColorSwatches';
import ProductGallery from './components/ProductGallery';
import PriceCalculator from './components/PriceCalculator';
import MockupPanel from './components/MockupPanel';
import { GALLERY_MAX_PX } from './components/galleryFrame';
import { fetchCatalogProduct, quoteCatalogProduct } from './api';
import { addCartItem } from './cartStorage';

const TAB_META = [
  { key: 'photo', label: 'Фото' },
  { key: 'artwork', label: 'Цвета' },
  { key: 'mockup', label: 'Примерка' }
];

function imagesForTab(product, tab, variantId) {
  const fromProduct = (product?.images || []).filter((i) => i.kind === tab);
  const fromVariant = (product?.variants || [])
    .flatMap((v) => (v.images || []).map((img) => ({ ...img, variantId: img.variantId ?? v.id })))
    .filter((i) => i.kind === tab);

  const all = [...fromProduct];
  for (const img of fromVariant) {
    if (!all.some((x) => x.id === img.id || (x.url === img.url && x.variantId === img.variantId))) {
      all.push(img);
    }
  }

  const forVariant = all.filter((i) => i.variantId === variantId);
  if (forVariant.length) return forVariant;
  const shared = all.filter((i) => i.variantId == null);
  if (shared.length) return shared;
  return all;
}

const BUD_VARIANT_LOOK = {
  'BP-GN': { hex: '#6F9A88', url: '/catalog/budgreen.svg' },
  'BP-RD': { hex: '#D9A8A8', url: '/catalog/budred.svg' },
  'BP-BL': { hex: '#9DBED4', url: '/catalog/budblue.svg' },
  // legacy SKUs до refresh
  'BP-NK': { hex: '#6F9A88', url: '/catalog/budgreen.svg' },
  'BP-BK': { hex: '#D9A8A8', url: '/catalog/budred.svg' },
  'BP-GD': { hex: '#9DBED4', url: '/catalog/budblue.svg' }
};

function variantColorUrl(variant) {
  if (!variant) return null;
  return BUD_VARIANT_LOOK[variant.sku]?.url || variant.previewImageUrl || null;
}

function withBudColors(variants) {
  return (variants || []).map((v) => {
    const look = BUD_VARIANT_LOOK[v.sku];
    if (!look) return v;
    return { ...v, colorHex: look.hex, previewImageUrl: look.url };
  });
}

function resolveGalleryUrl(product, tab, variant) {
  if (!product || !variant) return null;
  const variantId = variant.id;

  if (tab === 'photo') {
    return (
      imagesForTab(product, 'photo', variantId)[0]?.url
      || product.images.find((i) => i.kind === 'photo')?.url
      || variantColorUrl(variant)
      || null
    );
  }

  if (tab === 'artwork') {
    return (
      variantColorUrl(variant)
      || imagesForTab(product, 'artwork', variantId).find((i) => i.variantId === variantId)?.url
      || imagesForTab(product, 'artwork', variantId)[0]?.url
      || null
    );
  }

  return imagesForTab(product, tab, variantId)[0]?.url || null;
}

export default function ProductPage({ slug }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('photo');
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [hoverVariant, setHoverVariant] = useState(null);
  const [quantity, setQuantity] = useState(50);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [mockup, setMockup] = useState(null);
  const [addedFlash, setAddedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchCatalogProduct(slug);
        if (cancelled) return;
        setProduct(data);
        const first = (data.variants || []).find((v) => v.isAvailable) || data.variants?.[0];
        setSelectedVariantId(first?.id ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Товар не найден');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoteError('');
      try {
        const q = await quoteCatalogProduct(product.id, quantity);
        if (!cancelled) setQuote(q);
      } catch (e) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(e.message || 'Ошибка расчёта');
        }
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [product?.id, quantity]);

  const availableTabs = useMemo(() => {
    if (!product) return ['photo'];

    const fromConfig = (product.tabs || [])
      .filter((t) => t.isEnabled !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((t) => (t.type === 'colors' ? 'artwork' : t.type))
      .filter((t) => ['photo', 'artwork', 'mockup'].includes(t));

    if (fromConfig.length) return fromConfig;

    // Fallback без явных tabs (старые данные).
    const kinds = new Set([
      ...(product.images || []).map((i) => i.kind),
      ...(product.variants || []).flatMap((v) => (v.images || []).map((i) => i.kind))
    ]);
    if ((product.variants || []).some((v) => v.previewImageUrl)) kinds.add('artwork');
    const tabs = ['photo', 'artwork'].filter((k) => kinds.has(k));
    if ((product.artworkZones || []).length > 0) tabs.push('mockup');
    return tabs.length ? tabs : ['photo'];
  }, [product]);

  useEffect(() => {
    if (availableTabs.length && !availableTabs.includes(tab)) {
      setTab(availableTabs[0]);
    }
  }, [availableTabs, tab]);

  const displayVariant = hoverVariant || product?.variants?.find((v) => v.id === selectedVariantId);
  const zone = product?.artworkZones?.[0] || null;

  const mockupBaseUrl = useMemo(
    () => variantColorUrl(displayVariant) || zone?.baseImageUrl || null,
    [displayVariant, zone?.baseImageUrl]
  );

  const mainImageUrl = useMemo(
    () => resolveGalleryUrl(product, tab, displayVariant),
    [product, tab, displayVariant]
  );

  const caption = useMemo(() => {
    if (!product || !displayVariant || tab === 'photo' || tab === 'mockup') return null;
    return (
      imagesForTab(product, tab, displayVariant.id).find((i) => i.variantId === displayVariant.id)?.caption
      || imagesForTab(product, tab, displayVariant.id)[0]?.caption
      || null
    );
  }, [product, tab, displayVariant]);

  const tabs = TAB_META.filter((t) => availableTabs.includes(t.key));

  const activateArtworkTab = () => {
    if (availableTabs.includes('artwork')) setTab('artwork');
  };

  const handleColorPreview = (v) => {
    if (!v) return;
    setHoverVariant(v);
    if (tab !== 'mockup') activateArtworkTab();
  };

  const handleColorSelect = (v) => {
    setSelectedVariantId(v.id);
    setHoverVariant(v);
    if (tab !== 'mockup') activateArtworkTab();
  };

  const handleAdd = () => {
    if (!product || !selectedVariantId || !quote) return;
    const variant = product.variants.find((v) => v.id === selectedVariantId);
    addCartItem({
      productId: product.id,
      variantId: selectedVariantId,
      slug: product.slug,
      productName: product.name,
      colorName: variant?.colorName || '',
      sku: variant?.sku || '',
      previewImageUrl: variant?.previewImageUrl || mainImageUrl,
      quantity,
      unitPrice: quote.unitPrice,
      mockupTransformJson: mockup ? JSON.stringify(mockup) : null,
      logoFileUrl: mockup?.logoDataUrl || null
    });
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2000);
  };

  return (
    <CatalogShell title="Каталог продукции" dense>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {product && !loading && (
        <Stack spacing={2} sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
          <Breadcrumbs>
            <Link href="/catalog" underline="hover" color="inherit" variant="body2">
              Каталог
            </Link>
            {product.categoryName && (
              <Typography variant="body2" color="text.secondary">
                {product.categoryName}
              </Typography>
            )}
            <Typography variant="body2" color="text.primary">
              {product.name}
            </Typography>
          </Breadcrumbs>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {tabs.map((t) => (
              <Tab key={t.key} value={t.key} label={t.label} />
            ))}
          </Tabs>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: `minmax(0, ${GALLERY_MAX_PX}px) minmax(0, 1fr)`
              },
              gap: 3,
              alignItems: 'start',
              width: '100%'
            }}
          >
            <Box sx={{ width: '100%' }}>
              {tab === 'mockup' ? (
                <MockupPanel
                  zone={zone}
                  baseImageUrl={mockupBaseUrl}
                  transform={mockup}
                  onChange={setMockup}
                />
              ) : (
                <ProductGallery
                  key={mainImageUrl || 'empty'}
                  mainImageUrl={mainImageUrl}
                  caption={caption}
                  padded={tab === 'artwork'}
                />
              )}
            </Box>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: '100%' }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h5" component="h1" sx={{ m: 0 }}>
                    {product.name}
                  </Typography>
                  {product.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {product.description}
                    </Typography>
                  )}
                </Box>

                {availableTabs.includes('artwork') && (
                  <ColorSwatches
                    variants={withBudColors(product.variants)}
                    selectedId={selectedVariantId}
                    onSelect={handleColorSelect}
                    onPreview={handleColorPreview}
                  />
                )}

                {quoteError && <Alert severity="warning">{quoteError}</Alert>}

                <PriceCalculator
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  quote={quote}
                  onAddToCart={handleAdd}
                />

                {addedFlash && (
                  <Alert severity="success">
                    Добавлено в корзину.{' '}
                    <Link href="/cart" underline="hover">
                      Перейти
                    </Link>
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Box>
        </Stack>
      )}
    </CatalogShell>
  );
}
