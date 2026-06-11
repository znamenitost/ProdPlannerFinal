import { useEffect, useState } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Alert, 
  Box,
  Container,
  Avatar,
  Card,
  CardActionArea,
  CardContent
} from '@mui/material';
import { Login as LoginIcon, Person, AdminPanelSettings } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { createMuiTransition } from '../theme/motion';
import {
  avatarThumbUrl,
  normalizeLoginEmployees,
  parseLoginEmployeesBootstrap,
} from '../utils/loginEmployeesBootstrap';
import ParallaxPage from './ParallaxPage';
import './LoginForm.css';

export default function LoginForm({ onLogin }) {
  const [loginType, setLoginType] = useState('employee'); // 'employee' or 'admin'
  const [selectedEmployee, setSelectedEmployee] = useState('Дима');
  const [employees, setEmployees] = useState(() => parseLoginEmployeesBootstrap());
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const adminEmail = 'pavel@admin.com';

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadEmployees = async () => {
      let list = null;

      try {
        const jsonRes = await fetch('/login-employees.json', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (jsonRes.ok) list = await jsonRes.json();
      } catch {
        // fallback ниже
      }

      if (!Array.isArray(list) || list.length === 0) {
        try {
          const apiRes = await fetch('/api/auth/login-employees', {
            signal: controller.signal,
          });
          if (apiRes.ok) list = await apiRes.json();
        } catch {
          return;
        }
      }

      if (cancelled || !Array.isArray(list) || list.length === 0) return;

      const normalized = normalizeLoginEmployees(list);
      if (normalized.length === 0) return;

      setEmployees(normalized);
      setSelectedEmployee((prev) =>
        normalized.some((emp) => emp.fullName === prev) ? prev : normalized[0].fullName
      );
    };

    loadEmployees();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    setError('');
  };

  const handleEmployeeLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: selectedEmployee }),
        credentials: 'include'
      });

      const data = await parseAuthResponse(response);
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        credentials: 'include'
      });

      const data = await parseAuthResponse(response);
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  async function parseAuthResponse(response) {
    const text = await response.text();
    if (!text) {
      throw new Error(
        'API недоступен. Запустите бэкенд в отдельном терминале: dotnet run (порт 5234)'
      );
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Некорректный ответ сервера');
    }
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Ошибка входа');
    }
    return data;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loginType === 'employee') {
      handleEmployeeLogin();
    } else {
      handleAdminLogin();
    }
  };

  return (
    <ParallaxPage>
      <Container
        maxWidth="sm"
        className="login-content"
      >
        <Box className="login-form-shell">
          <Paper variant="section" sx={{ p: 4, width: '100%' }}>
            <Typography variant="h2" gutterBottom sx={{ textAlign: 'center', mb: 2 }}>
              Вход в систему
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mb: 3 }}>
              <Button
                fullWidth
                variant={loginType === 'employee' ? 'contained' : 'outlined'}
                onClick={() => handleLoginTypeChange('employee')}
                startIcon={<Person />}
              >
                Сотрудник
              </Button>
              <Button
                fullWidth
                variant={loginType === 'admin' ? 'contained' : 'outlined'}
                onClick={() => handleLoginTypeChange('admin')}
                startIcon={<AdminPanelSettings />}
              >
                Администратор
              </Button>
            </Box>
            
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {error && <Alert severity="error">{error}</Alert>}
                
                {loginType === 'employee' ? (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Выберите сотрудника:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                      {employees.map((emp) => {
                        const avatarSrc = emp.id ? avatarThumbUrl(emp.id) : undefined;

                        return (
                        <Card
                          key={emp.fullName}
                          sx={(theme) => ({
                            flex: 1,
                            border: selectedEmployee === emp.fullName
                              ? `2px solid ${theme.palette.primary.main}`
                              : `1px solid ${alpha(theme.palette.divider, 1)}`,
                            bgcolor: selectedEmployee === emp.fullName
                              ? alpha(theme.palette.primary.main, 0.08)
                              : alpha('#ffffff', 0.5),
                            transition: createMuiTransition(theme, [
                              'box-shadow',
                              'border-color',
                              'background-color'
                            ]),
                            '&:hover': { boxShadow: 2, borderColor: theme.palette.primary.light }
                          })}
                        >
                          <CardActionArea
                            onClick={() => setSelectedEmployee(emp.fullName)}
                            aria-pressed={selectedEmployee === emp.fullName}
                          >
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar
                              src={avatarSrc}
                              slotProps={{
                                img: {
                                  loading: 'lazy',
                                  decoding: 'async',
                                  fetchpriority: 'low',
                                },
                              }}
                              sx={{ width: 64, height: 64, fontSize: '1.5rem', mx: 'auto', mb: 1, bgcolor: 'primary.light' }}
                            >
                              {emp.fullName[0]}
                            </Avatar>
                            <Typography variant="body1" sx={{ fontWeight: selectedEmployee === emp.fullName ? 600 : 400 }}>
                              {emp.fullName}
                            </Typography>
                          </CardContent>
                          </CardActionArea>
                        </Card>
                        );
                      })}
                    </Box>
                  </>
                ) : (
                  <TextField
                    label="Пароль администратора"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    fullWidth
                  />
                )}
                
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  loading={loading}
                  startIcon={<LoginIcon />}
                  sx={{ mt: 2 }}
                >
                  {loading ? 'Вход...' : 'Войти'}
                </Button>
              </Box>
            </form>
          </Paper>
        </Box>
      </Container>
    </ParallaxPage>
  );
}
