import { useState } from 'react';
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
  CardContent,
  CircularProgress
} from '@mui/material';
import { Login as LoginIcon, Person, AdminPanelSettings } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { glassPaperSx } from '../theme/surfaces';

export default function LoginForm({ onLogin }) {
  const [loginType, setLoginType] = useState('employee'); // 'employee' or 'admin'
  const [selectedEmployee, setSelectedEmployee] = useState('Дима');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const employees = ['Дима', 'Яромир'];

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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка входа');
      }

      onLogin(data);
    } catch (err) {
      setError(err.message);
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка входа');
      }

      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loginType === 'employee') {
      handleEmployeeLogin();
    } else {
      handleAdminLogin();
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Avatar sx={{ m: 1, bgcolor: 'primary.main', width: 64, height: 64 }}>
          <LoginIcon sx={{ fontSize: 32 }} />
        </Avatar>
        
        <Typography variant="h1" gutterBottom sx={{ mt: 1 }}>Mainstream Assistant</Typography>
        <Paper sx={{ ...glassPaperSx, p: 4, width: '100%', mt: 2 }}>
          <Typography variant="h2" gutterBottom sx={{ textAlign: 'center', mb: 2 }}>Вход в систему</Typography>
          
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
                    {employees.map(emp => (
                      <Card 
                        key={emp}
                        onClick={() => setSelectedEmployee(emp)}
                        sx={(theme) => ({ 
                          flex: 1,
                          cursor: 'pointer',
                          border: selectedEmployee === emp ? '2px solid' : '1px solid',
                          borderColor: selectedEmployee === emp ? theme.palette.primary.main : theme.palette.divider,
                          bgcolor: selectedEmployee === emp ? alpha(theme.palette.primary.main, 0.08) : alpha('#fff', 0.5),
                          transition: 'all 0.2s',
                          '&:hover': { boxShadow: 2, borderColor: theme.palette.primary.light }
                        })}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                          <Avatar sx={{ width: 40, height: 40, mx: 'auto', mb: 1, bgcolor: 'primary.light' }}>
                            {emp[0]}
                          </Avatar>
                          <Typography variant="body1" sx={{ fontWeight: selectedEmployee === emp ? 600 : 400 }}>
                            {emp}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </>
              ) : (
                // Вход для администратора - email и пароль
                <>
                  <TextField
                    label="Email администратора"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    fullWidth
                    placeholder="pavel@admin.com"
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
                disabled={loading}
                fullWidth
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
                sx={{ mt: 2 }}
              >
                {loading ? 'Вход...' : 'Войти'}
              </Button>
            </Box>
          </form>
          
          {loginType === 'admin' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Администратор: pavel@admin.com / Admin123!
            </Typography>
          )}
        </Paper>
      </Box>
    </Container>
  );
}