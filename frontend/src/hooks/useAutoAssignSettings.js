import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAutoAssignSettings, saveAutoAssignSettings } from '../services/autoAssignSettingsApi';
import {
  createDefaultAutoAssignTypeRules,
  normalizeAutoAssignTypeRules
} from '../utils/autoAssignTypeRules';
import {
  getUserPreferencesKey,
  loadSharedPreference,
  loadUserPreference,
  saveSharedPreference
} from '../utils/userPreferencesStorage';

const ENABLED_KEY = 'splitModal.autoAssign';
const RULES_KEY = 'splitModal.autoAssignTypeRules';
const LEGACY_STORAGE_KEYS = [
  'app.preferences.v1.shared',
  'app.preferences.v1.admin'
];

function hasTypeRules(rules) {
  return Boolean(rules && typeof rules === 'object' && Object.keys(rules).length > 0);
}

function loadLegacyTypeRules(user) {
  const keys = [
    ...LEGACY_STORAGE_KEYS,
    user ? getUserPreferencesKey(user) : null
  ].filter(Boolean);

  for (const storageKey of keys) {
    const rules = loadUserPreference(storageKey, RULES_KEY, undefined);
    if (hasTypeRules(rules)) return rules;
  }

  return null;
}

function loadLegacyEnabled(user) {
  const keys = [
    ...LEGACY_STORAGE_KEYS,
    user ? getUserPreferencesKey(user) : null
  ].filter(Boolean);

  for (const storageKey of keys) {
    const value = loadUserPreference(storageKey, ENABLED_KEY, undefined);
    if (typeof value === 'boolean') return value;
  }

  return null;
}

export default function useAutoAssignSettings(user, employees, taskTypes, defaultEnabled = false) {
  const defaults = useMemo(
    () => createDefaultAutoAssignTypeRules(employees, taskTypes),
    [employees, taskTypes]
  );

  const [autoAssignEnabled, setEnabledState] = useState(
    () => loadSharedPreference(ENABLED_KEY, defaultEnabled)
  );
  const [rawTypeRules, setRawTypeRulesState] = useState(
    () => loadSharedPreference(RULES_KEY, defaults)
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);
  const snapshotRef = useRef({
    enabled: autoAssignEnabled,
    typeRules: normalizeAutoAssignTypeRules(rawTypeRules, employees, taskTypes)
  });

  const typeRules = useMemo(
    () => normalizeAutoAssignTypeRules(rawTypeRules, employees, taskTypes),
    [rawTypeRules, employees, taskTypes]
  );

  snapshotRef.current = { enabled: autoAssignEnabled, typeRules };

  const writeLocalCache = useCallback((enabled, rules) => {
    saveSharedPreference(ENABLED_KEY, enabled);
    saveSharedPreference(RULES_KEY, rules);
  }, []);

  const scheduleRemoteSave = useCallback((enabled, rules) => {
    if (!user || !hydratedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveAutoAssignSettings({ enabled, typeRules: rules }).catch(() => {});
    }, 300);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSettingsReady(false);
      hydratedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const remote = await fetchAutoAssignSettings();
        if (cancelled) return;

        const legacyRules = loadLegacyTypeRules(user);
        const legacyEnabled = loadLegacyEnabled(user);
        const remoteRules = hasTypeRules(remote?.typeRules) ? remote.typeRules : null;

        const nextEnabled = typeof remote?.enabled === 'boolean'
          ? remote.enabled
          : (legacyEnabled ?? loadSharedPreference(ENABLED_KEY, defaultEnabled));

        const nextRules = normalizeAutoAssignTypeRules(
          remoteRules ?? legacyRules ?? loadSharedPreference(RULES_KEY, defaults),
          employees,
          taskTypes
        );

        setEnabledState(nextEnabled);
        setRawTypeRulesState(nextRules);
        writeLocalCache(nextEnabled, nextRules);

        if (!remoteRules && legacyRules) {
          await saveAutoAssignSettings({ enabled: nextEnabled, typeRules: nextRules });
        }
      } catch {
        if (!cancelled) {
          const cachedRules = normalizeAutoAssignTypeRules(
            loadSharedPreference(RULES_KEY, defaults),
            employees,
            taskTypes
          );
          setEnabledState(loadSharedPreference(ENABLED_KEY, defaultEnabled));
          setRawTypeRulesState(cachedRules);
        }
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setSettingsReady(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, employees, taskTypes, defaults, defaultEnabled, writeLocalCache]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const setAutoAssignEnabled = useCallback((next) => {
    setEnabledState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const { typeRules: currentRules } = snapshotRef.current;
      writeLocalCache(resolved, currentRules);
      scheduleRemoteSave(resolved, currentRules);
      return resolved;
    });
  }, [scheduleRemoteSave, writeLocalCache]);

  const setTypeRules = useCallback((next) => {
    setRawTypeRulesState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const normalized = normalizeAutoAssignTypeRules(resolved, employees, taskTypes);
      const { enabled } = snapshotRef.current;
      writeLocalCache(enabled, normalized);
      scheduleRemoteSave(enabled, normalized);
      return normalized;
    });
  }, [employees, taskTypes, scheduleRemoteSave, writeLocalCache]);

  return {
    autoAssignEnabled,
    setAutoAssignEnabled,
    typeRules,
    setTypeRules,
    settingsReady
  };
}
