import { useCallback, useEffect, useState } from 'react';

const DEFAULT_EMPLOYEE = 'Дима';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(DEFAULT_EMPLOYEE);

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
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Ошибка проверки авторизации:', err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    checkAuth();
    return () => controller.abort();
  }, []);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
    if (userData.role !== 'Admin') setEmployee(userData.fullName);
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setEmployee(DEFAULT_EMPLOYEE);
  }, []);

  return {
    user,
    setUser,
    loading,
    employee,
    setEmployee,
    handleLogin,
    handleLogout
  };
}
