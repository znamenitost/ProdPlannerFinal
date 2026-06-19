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

export async function fetchPendingCdrPreviewRetries(limit = 50) {
  const response = await fetch(`/api/tasks/cdr-preview/pending-retries?limit=${limit}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const items = await response.json();
  return Array.isArray(items) ? items : [];
}

export async function scheduleCdrPreviewRetry(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/cdr-preview/schedule-retry`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function reportCdrPreviewRetryFailed(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/cdr-preview/retry-failed`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
