async function parseJson(res) {
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Некорректный ответ сервера');
  }
  if (!res.ok) {
    throw new Error(payload?.error || `Ошибка ${res.status}`);
  }
  return payload;
}

export async function fetchCatalogProducts(category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`/api/public/catalog/products${qs}`, { cache: 'no-store' });
  return parseJson(res);
}

export async function fetchCatalogProduct(slug) {
  const res = await fetch(`/api/public/catalog/products/${encodeURIComponent(slug)}`, {
    cache: 'no-store'
  });
  return parseJson(res);
}

export async function quoteCatalogProduct(productId, quantity) {
  const res = await fetch('/api/public/catalog/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity })
  });
  return parseJson(res);
}

export async function checkoutCatalogOrder(payload) {
  const res = await fetch('/api/public/catalog/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJson(res);
}

export async function startCatalogLogoBackgroundRemoval(imageDataUrl, fileName) {
  const res = await fetch('/api/public/catalog/remove-background/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, fileName: fileName || undefined })
  });
  return parseJson(res);
}

export async function getCatalogLogoBackgroundRemovalStatus(jobId) {
  const res = await fetch(`/api/public/catalog/remove-background/status/${jobId}`);
  return parseJson(res);
}

export async function vectorizeCatalogLogo(imageDataUrl, fileName) {
  const res = await fetch('/api/public/catalog/vectorize-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, fileName: fileName || undefined })
  });

  if (!res.ok) {
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // A proxy/IIS error page is not JSON; use the HTTP status below.
    }
    throw new Error(payload?.error || `Ошибка ${res.status}`);
  }

  return res.blob();
}
