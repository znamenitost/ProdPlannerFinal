import { useClockMinuteTick } from '../context/ClockContext';

/** @deprecated Используйте useClockMinuteTick из ClockContext. */
export default function useClockMinute(enabled = true) {
  return useClockMinuteTick(enabled);
}
