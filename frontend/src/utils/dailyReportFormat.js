/** Форматирование строк отчёта за день по интервалам работы. */

export function formatHoursRu(value) {
  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  const abs = Math.abs(rounded);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let word = 'часов';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'час';
    else if (mod10 >= 2 && mod10 <= 4) word = 'часа';
  }
  return `${display} ${word}`;
}

/** Человекочасы за день (итоговая строка). */
export function formatPersonHoursRu(value) {
  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  const abs = Math.abs(rounded);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let word = 'человекочасов';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'человекочас';
    else if (mod10 >= 2 && mod10 <= 4) word = 'человекочаса';
  }
  return `${display} ${word}`;
}

export function formatHourToken(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatDailyReportLine(item) {
  const hoursPart = item.intervalHours.length > 1
    ? `(${item.intervalHours.map(formatHourToken).join('+')}) ${formatHoursRu(item.totalHours)}`
    : formatHoursRu(item.totalHours);
  const statusPart = item.isCompleted ? 'Выполнена' : 'В процессе';
  return `${item.title} ${hoursPart}. ${statusPart}`;
}
