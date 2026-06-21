export async function fetchMaxLinkStatus() {
  const response = await fetch('/api/me/max', { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function createMaxLinkToken() {
  const response = await fetch('/api/me/max/link-token', {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function unlinkMaxAccount() {
  const response = await fetch('/api/me/max/link', {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function fetchMaxSubscribedTaskIds() {
  const response = await fetch('/api/me/max/subscriptions', { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.taskIds) ? data.taskIds : [];
}

export async function subscribeTaskMax(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/max-subscription`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
}

export async function unsubscribeTaskMax(taskId) {
  const response = await fetch(`/api/tasks/${taskId}/max-subscription`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
