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
  Badge,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { Check as CheckIcon, Login as LoginIcon, Person, AdminPanelSettings } from '@mui/icons-material';
import {
  avatarThumbUrl,
  normalizeLoginEmployees,
  parseLoginEmployeesBootstrap,
} from '../utils/loginEmployeesBootstrap';
import ParallaxPage from './ParallaxPage';
import {
  ADMIN_LOGIN_ACCOUNTS,
  DEPLOY_PREPARE_ADMIN_FULL_NAME,
  sortAdminLoginAccounts
} from '../constants/adminLoginAccounts';
import './LoginForm.css';

/** Exclusive account pick — ToggleButtonGroup + Avatar Badge (MUI docs). */
function LoginAccountPicker({
  options,
  value,
  onChange,
  ariaLabel,
  avatarSize = 64,
  fullWidthLast = false
}) {
  return (
    <ToggleButtonGroup
      color="primary"
      value={value}
      exclusive
      onChange={(_event, next) => {
        if (next !== null) onChange(next);
      }}
      aria-label={ariaLabel}
      fullWidth
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        '& .MuiToggleButtonGroup-grouped': {
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px !important',
          marginLeft: 0,
          flex: '1 1 120px'
        }
      }}
    >
      {options.map((opt, index) => {
        const selected = value === opt.value;
        const isLastFullWidth = fullWidthLast && index === options.length - 1 && options.length > 1;
        return (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            aria-label={opt.value}
            sx={{
              flexDirection: 'column',
              gap: 1,
              py: 2,
              textTransform: 'none',
              ...(isLastFullWidth ? { flex: '1 1 100% !important' } : null)
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={<CheckIcon sx={{ fontSize: 14 }} />}
              color="primary"
              invisible={!selected}
              sx={{
                '& .MuiBadge-badge': {
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: (theme) => `2px solid ${theme.palette.background.paper}`,
                  p: 0
                }
              }}
            >
              <Avatar
                alt={opt.value}
                src={opt.avatarSrc}
                slotProps={{
                  img: {
                    loading: 'lazy',
                    decoding: 'async',
                    fetchpriority: 'low'
                  }
                }}
                sx={{
                  width: avatarSize,
                  height: avatarSize,
                  fontSize: avatarSize > 56 ? '1.5rem' : '1.25rem',
                  bgcolor: 'primary.light',
                  ...(selected
                    ? {
                        outline: (theme) => `3px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2
                      }
                    : null)
                }}
              >
                {opt.value[0]}
              </Avatar>
            </Badge>
            <Typography
              variant={avatarSize > 56 ? 'body1' : 'body2'}
              color="inherit"
              sx={{ fontWeight: selected ? 600 : 400 }}
            >
              {opt.value}
            </Typography>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}

export default function LoginForm({ onLogin }) {
  const [loginType, setLoginType] = useState('employee'); // 'employee' or 'admin'
  const [selectedEmployee, setSelectedEmployee] = useState('Дима');
  const [employees, setEmployees] = useState(() => parseLoginEmployeesBootstrap());
  const [admins, setAdmins] = useState(() => sortAdminLoginAccounts(ADMIN_LOGIN_ACCOUNTS));
  const [selectedAdmin, setSelectedAdmin] = useState(DEPLOY_PREPARE_ADMIN_FULL_NAME);
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedAdminAccount = admins.find((a) => a.fullName === selectedAdmin)
    ?? admins.find((a) => a.fullName === DEPLOY_PREPARE_ADMIN_FULL_NAME)
    ?? admins[0]
    ?? ADMIN_LOGIN_ACCOUNTS[ADMIN_LOGIN_ACCOUNTS.length - 1];

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const normalizeLoginAdmins = (list) => {
      if (!Array.isArray(list)) return [];

      return list
        .map((item) => {
          if (!item || typeof item !== 'object') return null;

          const fullName = String(item.fullName ?? '').trim();
          const email = String(item.email ?? '').trim().toLowerCase();
          if (!fullName || !email) return null;

          return {
            id: item.id != null ? String(item.id).trim() : '',
            fullName,
            email,
            avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl.trim() : undefined,
          };
        })
        .filter(Boolean);
    };

    const loadAdmins = async () => {
      try {
        const response = await fetch('/api/auth/login-admins', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (cancelled) return;

        const normalized = sortAdminLoginAccounts(normalizeLoginAdmins(payload));
        if (normalized.length === 0) return;

        setAdmins(normalized);
        setSelectedAdmin((prev) =>
          normalized.some((admin) => admin.fullName === prev)
            ? prev
            : (normalized.find((a) => a.fullName === DEPLOY_PREPARE_ADMIN_FULL_NAME)?.fullName
              ?? normalized[0].fullName)
        );
      } catch {
        // fallback to static admin list
      }
    };

    loadAdmins();

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
        body: JSON.stringify({ email: selectedAdminAccount.email, password: adminPassword }),
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
                    <LoginAccountPicker
                      ariaLabel="Выберите сотрудника"
                      value={selectedEmployee}
                      onChange={setSelectedEmployee}
                      avatarSize={64}
                      options={employees.map((emp) => ({
                        value: emp.fullName,
                        avatarSrc: emp.id ? avatarThumbUrl(emp.id) : undefined
                      }))}
                    />
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Выберите администратора:
                    </Typography>
                    <LoginAccountPicker
                      ariaLabel="Выберите администратора"
                      value={selectedAdmin}
                      onChange={setSelectedAdmin}
                      avatarSize={56}
                      fullWidthLast
                      options={admins.map((admin) => ({
                        value: admin.fullName,
                        avatarSrc: admin.id ? avatarThumbUrl(admin.id) : admin.avatarUrl
                      }))}
                    />
                    <TextField
                      label="Пароль"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      fullWidth
                    />
                  </>
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
