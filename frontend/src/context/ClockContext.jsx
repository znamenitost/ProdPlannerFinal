import { createContext, useContext, useEffect } from 'react';
import { useSyncExternalStore } from 'react';

function minuteKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

const tickStore = {
  tick: minuteKey(),
  listeners: new Set()
};

function subscribe(listener) {
  tickStore.listeners.add(listener);
  return () => tickStore.listeners.delete(listener);
}

function getSnapshot() {
  return tickStore.tick;
}

function setTick(next) {
  if (tickStore.tick === next) return;
  tickStore.tick = next;
  tickStore.listeners.forEach((listener) => listener());
}

export function ClockProvider({ children }) {
  useEffect(() => {
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

    setTick(minuteKey());
    arm();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <ClockContext.Provider value={tickStore}>
      {children}
    </ClockContext.Provider>
  );
}

const ClockContext = createContext(null);

export function useClockMinuteTick(enabled = true) {
  const store = useContext(ClockContext);
  return useSyncExternalStore(
    enabled && store ? subscribe : () => () => {},
    () => (enabled && store ? getSnapshot() : null),
    () => (enabled && store ? getSnapshot() : null)
  );
}
