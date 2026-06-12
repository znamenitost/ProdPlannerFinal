import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getUserPreferencesKey,
  loadUserPreference,
  saveUserPreference
} from '../utils/userPreferencesStorage';

export default function useUserPreference(currentUser, preferenceKey, defaultValue) {
  const storageKey = useMemo(
    () => getUserPreferencesKey(currentUser),
    [currentUser?.id, currentUser?.role, currentUser?.fullName]
  );

  const readValue = useCallback(
    () => loadUserPreference(storageKey, preferenceKey, defaultValue),
    [storageKey, preferenceKey, defaultValue]
  );

  const [value, setValueState] = useState(readValue);

  useEffect(() => {
    setValueState(readValue());
  }, [readValue]);

  const setValue = useCallback((next) => {
    setValueState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      saveUserPreference(storageKey, preferenceKey, resolved);
      return resolved;
    });
  }, [storageKey, preferenceKey]);

  return [value, setValue];
}
