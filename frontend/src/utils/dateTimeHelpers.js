export const WORK_HOUR_MIN = 11;
export const WORK_HOUR_MAX = 19;
export const DEFAULT_TIME = '15:00';

export function parseTimeToHour(timeStr) {
  const hour = parseInt((timeStr || DEFAULT_TIME).split(':')[0], 10);
  if (!Number.isFinite(hour)) return 15;
  return Math.min(WORK_HOUR_MAX, Math.max(WORK_HOUR_MIN, hour));
}

export function formatHourAsTime(hour) {
  const h = Math.min(WORK_HOUR_MAX, Math.max(WORK_HOUR_MIN, hour));
  return `${h.toString().padStart(2, '0')}:00`;
}

export const WORK_TIME_OPTIONS = [];
for (let h = WORK_HOUR_MIN; h <= WORK_HOUR_MAX; h++) {
  WORK_TIME_OPTIONS.push(formatHourAsTime(h));
}

export const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return { date: '', time: DEFAULT_TIME };
  const [datePart, timePart] = dateTimeStr.split('T');
  if (!datePart) return { date: '', time: DEFAULT_TIME };
  const time = timePart ? formatHourAsTime(parseTimeToHour(timePart)) : DEFAULT_TIME;
  return { date: datePart, time };
};

export const combineDateTime = (date, time) => {
  if (!date) return '';
  const [h] = (time || DEFAULT_TIME).split(':');
  const hour = Math.min(WORK_HOUR_MAX, Math.max(WORK_HOUR_MIN, parseInt(h, 10) || WORK_HOUR_MIN));
  return `${date}T${hour.toString().padStart(2, '0')}:00`;
};

export const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getLeftPercent = (dateTime) => {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - WORK_HOUR_MIN) / (WORK_HOUR_MAX - WORK_HOUR_MIN)) * 100;
};

export const getWidthPercent = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  return (duration / (WORK_HOUR_MAX - WORK_HOUR_MIN)) * 100;
};
