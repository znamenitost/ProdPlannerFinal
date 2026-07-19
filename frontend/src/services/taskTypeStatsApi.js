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

export async function fetchTaskTypeStats({ signal } = {}) {
  const response = await fetch(`${API_BASE}/stats/task-types`, {
    credentials: 'include',
    signal
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('API статистики не найден — перезапустите бэкенд (dotnet run)');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Недостаточно прав для просмотра статистики');
    }
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}
