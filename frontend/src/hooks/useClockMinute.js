import { useEffect, useState } from 'react';

function minuteKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

/** Смена значения в начале каждой календарной минуты (для сдвига шкалы времени). */
export default function useClockMinute(enabled = true) {
  const [tick, setTick] = useState(minuteKey);

  useEffect(() => {
    if (!enabled) return undefined;

    let timeoutId;

    const arm = () => {
      const now = new Date();
      const msUntilNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      timeoutId = setTimeout(() => {
        setTick(minuteKey());
        arm();
      }, msUntilNextMinute);
    };

    arm();
    return () => clearTimeout(timeoutId);
  }, [enabled]);

  return tick;
}
