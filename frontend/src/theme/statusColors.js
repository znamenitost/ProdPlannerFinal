/** MUI Chip `color` for task status labels */
export function getStatusChipColor(status) {
  const text = typeof status === "string" ? status.trim() : "";
  if (text === "Готово") return "success";
  if (text === "Начал") return "info";
  if (text === "Пауза") return "warning";
  return "default";
}

export function getStatusIconColor(status) {
  const chip = getStatusChipColor(status);
  if (chip === "default") return "text.secondary";
  return `${chip}.main`;
}
