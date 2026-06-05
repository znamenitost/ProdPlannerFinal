const FALLBACK_EMPLOYEES = [
  { id: null, fullName: 'Дима', avatarUrl: null },
  { id: null, fullName: 'Яромир', avatarUrl: null },
];

export function normalizeLoginEmployees(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((emp) => ({
      id: emp.id ?? null,
      fullName: emp.fullName ?? '',
      avatarUrl: emp.avatarUrl ?? null,
    }))
    .filter((emp) => emp.fullName);
}

export function parseLoginEmployeesBootstrap() {
  const el = document.getElementById('login-employees-bootstrap');
  if (el?.textContent?.trim()) {
    try {
      const normalized = normalizeLoginEmployees(JSON.parse(el.textContent));
      if (normalized.length > 0) return normalized;
    } catch {
      // fallback ниже
    }
  }

  return FALLBACK_EMPLOYEES;
}

export function avatarThumbUrl(userId, size = 64) {
  if (!userId) return undefined;
  return `/api/auth/avatar/${userId}?w=${size}`;
}
