const WORK_START_MIN = 10 * 60;
const LUNCH_START_MIN = 14 * 60;
const LUNCH_END_MIN = 15 * 60;
const WORK_END_MIN = 19 * 60;

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** Следующий момент начала работы (логика как WorkHoursCalculator.GetNextWorkStart). */
export function getNextWorkStart(from) {
  let t = new Date(from);

  if (t.getDay() === 6) {
    t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2, 10, 0, 0, 0);
  } else if (t.getDay() === 0) {
    t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 10, 0, 0, 0);
  } else {
    const mod = minutesOfDay(t);
    if (mod < WORK_START_MIN) {
      t = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 10, 0, 0, 0);
    } else if (mod >= LUNCH_START_MIN && mod < LUNCH_END_MIN) {
      t = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 15, 0, 0, 0);
    } else if (mod >= WORK_END_MIN) {
      const next = new Date(t);
      next.setDate(next.getDate() + 1);
      t = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 10, 0, 0, 0);
    }
  }

  if (isWeekend(t)) return getNextWorkStart(t);
  return t;
}

/** Рабочие часы между двумя моментами (как WorkHoursCalculator.GetWorkHoursBetween). */
export function getWorkHoursBetween(start, end) {
  if (!start || !end || start >= end) return 0;

  let totalMinutes = 0;
  let currentDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (currentDate <= endDate) {
    if (!isWeekend(currentDate)) {
      const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 10, 0, 0, 0);
      const dayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 19, 0, 0, 0);

      let intervalStart = start > dayStart ? start : dayStart;
      let intervalEnd = end < dayEnd ? end : dayEnd;

      if (intervalStart < intervalEnd) {
        let workMinutes = (intervalEnd - intervalStart) / 60000;

        const lunchStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 14, 0, 0, 0);
        const lunchEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 15, 0, 0, 0);

        if (intervalStart < lunchEnd && intervalEnd > lunchStart) {
          const lunchOverlapStart = intervalStart > lunchStart ? intervalStart : lunchStart;
          const lunchOverlapEnd = intervalEnd < lunchEnd ? intervalEnd : lunchEnd;
          workMinutes -= (lunchOverlapEnd - lunchOverlapStart) / 60000;
        }

        totalMinutes += Math.max(0, workMinutes);
      }
    }
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }

  return Math.round((totalMinutes / 60) * 100) / 100;
}
