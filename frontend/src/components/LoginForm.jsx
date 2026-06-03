import { useEffect, useRef, useState } from 'react';
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
import fon1Url from '../../../sprites/fon1.svg';
import fon2Url from '../../../sprites/fon2.svg';
import fon3Url from '../../../sprites/fon3.svg';
import fon5Url from '../../../sprites/fon5.svg';
import sunUrl from '../../../sprites/sun.svg';
import './LoginForm.css';

const FALLBACK_EMPLOYEES = [
  { id: null, fullName: 'Дима', avatarUrl: null },
  { id: null, fullName: 'Яромир', avatarUrl: null },
];

export default function LoginForm({ onLogin }) {
  const pageRef = useRef(null);
  const [loginType, setLoginType] = useState('employee'); // 'employee' or 'admin'
  const [selectedEmployee, setSelectedEmployee] = useState('Дима');
  const [employees, setEmployees] = useState(FALLBACK_EMPLOYEES);
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const adminEmail = 'pavel@admin.com';

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/login-employees')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((list) => {
        if (cancelled || !Array.isArray(list) || list.length === 0) return;

        const normalized = list
          .map((emp) => ({
            id: emp.id ?? null,
            fullName: emp.fullName ?? '',
            avatarUrl: emp.avatarUrl ?? null,
          }))
          .filter((emp) => emp.fullName);

        if (normalized.length === 0) return;

        setEmployees(normalized);
        setSelectedEmployee((prev) =>
          normalized.some((emp) => emp.fullName === prev) ? prev : normalized[0].fullName
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);
  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    setError('');
  };

  const handleParallaxMove = (event) => {
    const page = pageRef.current;
    if (!page) return;

    const rect = page.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    page.style.setProperty('--layer-1-x', `${x * -13}px`);
    page.style.setProperty('--layer-1-y', `${y * -5}px`);
    page.style.setProperty('--layer-2-x', `${x * -30}px`);
    page.style.setProperty('--layer-2-y', `${y * -10}px`);
    page.style.setProperty('--layer-3-x', `${x * -50}px`);
    page.style.setProperty('--layer-3-y', `${y * -16}px`);
    page.style.setProperty('--layer-5-x', `${x * -84}px`);
    page.style.setProperty('--layer-5-y', `${y * -24}px`);
  };

  const resetParallax = () => {
    const page = pageRef.current;
    if (!page) return;

    page.style.setProperty('--layer-1-x', '0px');
    page.style.setProperty('--layer-1-y', '0px');
    page.style.setProperty('--layer-2-x', '0px');
    page.style.setProperty('--layer-2-y', '0px');
    page.style.setProperty('--layer-3-x', '0px');
    page.style.setProperty('--layer-3-y', '0px');
    page.style.setProperty('--layer-5-x', '0px');
    page.style.setProperty('--layer-5-y', '0px');
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
    <main
      ref={pageRef}
      className="login-parallax-page"
      onMouseMove={handleParallaxMove}
      onMouseLeave={resetParallax}
      style={{
        '--fon1-image': `url(${fon1Url})`,
        '--fon2-image': `url(${fon2Url})`,
        '--fon3-image': `url(${fon3Url})`,
        '--fon5-image': `url(${fon5Url})`,
        '--sun-image': `url(${sunUrl})`
      }}
    >
      <img className="login-parallax-layer login-layer-fon1" src={fon1Url} alt="" aria-hidden="true" />
      <img className="login-sun-layer" src={sunUrl} alt="" aria-hidden="true" />
      <img className="login-parallax-layer login-layer-fon2" src={fon2Url} alt="" aria-hidden="true" />
      <img className="login-parallax-layer login-layer-fon3" src={fon3Url} alt="" aria-hidden="true" />
      <img className="login-parallax-layer login-layer-fon5" src={fon5Url} alt="" aria-hidden="true" />

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
                  // Вход для сотрудника - выбор имени
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Выберите сотрудника:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                      {employees.map((emp) => {
                        const avatarSrc = emp.avatarUrl && emp.id
                          ? `/api/auth/avatar/${emp.id}`
                          : undefined;

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
                  // Вход для администратора - общий пароль без отображения email.
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
    </main>
  );
}