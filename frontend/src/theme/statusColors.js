/** MUI Chip `color` for task status labels */
export function getStatusChipColor(status) {
  const text = typeof status === 'string' ? status.trim() : '';
  if (text === 'Готово' || text === 'Согласовано' || text === 'В наличии') return 'success';
  if (text === 'Начал') return 'info';
  if (text === 'Пауза') return 'warning';
  if (text === 'Согласование' || text === 'На согласовании') return 'warning';
  if (text === 'Нет изделий') return 'error';
  if (text === 'Ожидание') return 'default';
  return 'default';
}

export function getStatusIconColor(status) {
  const chip = getStatusChipColor(status);
  if (chip === 'default') return 'text.secondary';
  return `${chip}.main`;
}
