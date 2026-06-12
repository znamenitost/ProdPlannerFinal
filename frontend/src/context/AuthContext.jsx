import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getUserPreferencesKey,
  loadUserPreference,
  saveUserPreference
} from '../utils/userPreferencesStorage';

const DEFAULT_EMPLOYEE = 'Дима';
const ADMIN_EMPLOYEE_OPTIONS = ['Дима', 'Яромир', 'Павел'];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [employee, setEmployee] = useState(DEFAULT_EMPLOYEE);
  const loadedAdminEmployeePrefRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: controller.signal
        });
        if (!response.ok) return;

        const data = await response.json();
        if (data.isAuthenticated) {
          setUser(data);
          if (data.role !== 'Admin') setEmployee(data.fullName);
        } else {
          setUser(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Ошибка проверки авторизации:', err);
        }
      } finally {
        if (!controller.signal.aborted) setAuthChecking(false);
      }
    }

    checkAuth();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'Admin') {
      loadedAdminEmployeePrefRef.current = false;
      return;
    }
    if (loadedAdminEmployeePrefRef.current) return;

    const stored = loadUserPreference(
      getUserPreferencesKey(user),
      'selectedEmployee',
      DEFAULT_EMPLOYEE
    );
    if (ADMIN_EMPLOYEE_OPTIONS.includes(stored)) {
      setEmployee(stored);
    }
    loadedAdminEmployeePrefRef.current = true;
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'Admin') return;
    if (!loadedAdminEmployeePrefRef.current) return;
    saveUserPreference(getUserPreferencesKey(user), 'selectedEmployee', employee);
  }, [user, employee]);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
    loadedAdminEmployeePrefRef.current = false;
    if (userData.role !== 'Admin') {
      setEmployee(userData.fullName);
      return;
    }
    const stored = loadUserPreference(
      getUserPreferencesKey(userData),
      'selectedEmployee',
      DEFAULT_EMPLOYEE
    );
    setEmployee(ADMIN_EMPLOYEE_OPTIONS.includes(stored) ? stored : DEFAULT_EMPLOYEE);
    loadedAdminEmployeePrefRef.current = true;
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setEmployee(DEFAULT_EMPLOYEE);
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      authChecking,
      employee,
      setEmployee,
      handleLogin,
      handleLogout,
    }),
    [user, authChecking, employee, handleLogin, handleLogout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
