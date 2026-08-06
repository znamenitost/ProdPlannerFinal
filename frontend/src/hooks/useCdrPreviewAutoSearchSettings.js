import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCdrPreviewAutoSearchSettings,
  saveCdrPreviewAutoSearchSettings
} from '../services/cdrPreviewAutoSearchSettingsApi';

function clampMinutes(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 1440);
}

export default function useCdrPreviewAutoSearchSettings(user) {
  const [minutes, setMinutesState] = useState(2);
  const minutesRef = useRef(0);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);

  minutesRef.current = minutes;

  const scheduleSave = useCallback((value) => {
    if (!user || !hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveCdrPreviewAutoSearchSettings({ minutes: value }).catch(() => {});
    }, 300);
  }, [user]);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const remote = await fetchCdrPreviewAutoSearchSettings();
        if (cancelled) return;
        setMinutesState(clampMinutes(remote?.minutes));
      } catch {
        // keep default
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const setMinutes = useCallback((next) => {
    setMinutesState((prev) => {
      const resolved = clampMinutes(typeof next === 'function' ? next(prev) : next);
      scheduleSave(resolved);
      return resolved;
    });
  }, [scheduleSave]);

  const getAutoSearchMinutes = useCallback(() => minutesRef.current, []);

  return { minutes, setMinutes, getAutoSearchMinutes };
}
