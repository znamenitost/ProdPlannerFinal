// ./frontend/src/utils/dateTimeHelpers.js
export const WORK_TIME_OPTIONS = [];
for (let h = 10; h <= 19; h++) {
  for (let m of [0, 30]) {
    if (h === 19 && m === 30) continue;
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    WORK_TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}
export const DEFAULT_TIME = '15:00';

export const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return { date: '', time: DEFAULT_TIME };
  const date = new Date(dateTimeStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
};

export const combineDateTime = (date, time) => {
  if (!date) return '';
  return `${date}T${time}`;
};

export const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Функции для расчёта позиций в календаре (рабочий день 10-19 часов = 9 часов)
export const getLeftPercent = (dateTime) => {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - 10) / 9) * 100;
};

export const getWidthPercent = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  return (duration / 9) * 100;
};