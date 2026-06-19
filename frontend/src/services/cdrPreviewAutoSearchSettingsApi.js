const API_BASE = '/api';

async function readErrorMessage(response) {
  const text = (await response.text().catch(() => '')).trim();
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    return body?.error || body?.message || text;
  } catch {
    return text;
  }
}

export async function fetchCdrPreviewAutoSearchSettings() {
  const response = await fetch(`${API_BASE}/settings/cdr-preview-autosearch`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function saveCdrPreviewAutoSearchSettings(settings) {
  const response = await fetch(`${API_BASE}/settings/cdr-preview-autosearch`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
