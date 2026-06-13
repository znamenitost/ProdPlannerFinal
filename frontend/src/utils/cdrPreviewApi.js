async function readErrorMessage(response) {
  const text = (await response.text().catch(() => '')).trim();
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    return body?.error || text;
  } catch {
    return text;
  }
}

export async function fetchTaskCdrPreview(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/cdr-preview`, {
    credentials: 'include'
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  if (!blob.size) return null;

  return {
    url: URL.createObjectURL(blob),
    method: 'БД (WebP)',
    path: response.headers.get('X-Preview-Source-Key') || '',
    sourceKey: response.headers.get('X-Preview-Source-Key') || ''
  };
}

export async function uploadTaskCdrPreview(taskId, blob, sourceKey, method = '') {
  const form = new FormData();
  form.append('file', blob, 'preview.png');
  form.append('sourceKey', sourceKey || '');
  if (method) form.append('method', method);

  const response = await fetch(`/api/tasks/${taskId}/cdr-preview`, {
    method: 'PUT',
    credentials: 'include',
    body: form
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

async function previewUrlToBlob(url) {
  if (!url) return null;
  const response = await fetch(url);
  return response.blob();
}

export async function persistTaskCdrPreview(taskId, preview) {
  if (!taskId || !preview?.url) return preview;

  const blob = await previewUrlToBlob(preview.url);
  if (!blob?.size) return preview;

  await uploadTaskCdrPreview(taskId, blob, preview.path || preview.sourceKey || '', preview.method || '');

  if (preview.url.startsWith('blob:')) {
    URL.revokeObjectURL(preview.url);
  }

  const stored = await fetchTaskCdrPreview(taskId);
  return stored || preview;
}
