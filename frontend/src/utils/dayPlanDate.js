function isWorkingWeekday(date) {
  const day = new Date(date).getDay();
  return day >= 1 && day <= 5;
}

function toCalendarDayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addWorkdays(date, amount) {
  const next = startOfDay(date);
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    next.setDate(next.getDate() + direction);
    if (isWorkingWeekday(next)) remaining -= 1;
  }

  return next;
}

export function getWorkdayOrPrevious(date) {
  const next = startOfDay(date);
  while (!isWorkingWeekday(next)) {
    next.setDate(next.getDate() - 1);
  }
  return next;
}

export function getWorkdayOrNext(date) {
  const next = startOfDay(date);
  while (!isWorkingWeekday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function formatDayPlanDateKey(date) {
  return toCalendarDayKey(date);
}

/** После 19:00 и в выходные якорь — следующий рабочий день. */
export function getPlanAnchorDate(now = new Date()) {
  const current = startOfDay(now);
  if (!isWorkingWeekday(current) || now.getHours() >= 19) {
    return addWorkdays(current, 1);
  }
  return current;
}

