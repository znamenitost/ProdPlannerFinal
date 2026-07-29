function normalizeEmployeeName(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU');
}

export function isSameEmployeeName(left, right) {
  const a = normalizeEmployeeName(left);
  const b = normalizeEmployeeName(right);
  return Boolean(a) && a === b;
}
