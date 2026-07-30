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

function opts(init = {}) {
  return { credentials: 'include', cache: 'no-store', ...init };
}

export async function adminFetchTree() {
  const res = await fetch('/api/catalog/admin/tree', opts());
  return parseJson(res);
}

export async function adminCheckBackgroundRemovalHealth() {
  const res = await fetch('/api/catalog/admin/background-removal-health', opts());
  return parseJson(res);
}

export async function adminFetchProduct(id) {
  const res = await fetch(`/api/catalog/admin/products/${id}`, opts());
  return parseJson(res);
}

export async function adminCreateCategory(body) {
  const res = await fetch('/api/catalog/admin/categories', opts({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  return parseJson(res);
}

export async function adminCreateProduct(body) {
  const res = await fetch('/api/catalog/admin/products', opts({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  return parseJson(res);
}

export async function adminUpdateProduct(id, body) {
  const res = await fetch(`/api/catalog/admin/products/${id}`, opts({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminDeleteProduct(id) {
  const res = await fetch(`/api/catalog/admin/products/${id}`, opts({ method: 'DELETE' }));
  if (!res.ok) return parseJson(res);
}

export async function adminAddTab(productId, body) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/tabs`, opts({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  return parseJson(res);
}

export async function adminRemoveTab(productId, tabId) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/tabs/${tabId}`, opts({
    method: 'DELETE'
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminSetPhoto(productId, url, caption) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/photo`, opts({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, caption })
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminReplaceVariants(productId, variants) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/variants`, opts({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variants)
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminReplaceTiers(productId, tiers) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/price-tiers`, opts({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tiers)
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminUpsertZone(productId, zone) {
  const res = await fetch(`/api/catalog/admin/products/${productId}/zone`, opts({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(zone)
  }));
  if (!res.ok) return parseJson(res);
}

export async function adminUpload(file, kind = 'image') {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/catalog/admin/upload?kind=${encodeURIComponent(kind)}`, opts({
    method: 'POST',
    body: fd
  }));
  return parseJson(res);
}
