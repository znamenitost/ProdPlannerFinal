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
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ m: 1, bgcolor: 'primary.main', width: 56, height: 56 }}>
          <LoginIcon sx={{ fontSize: 32 }} />
        </Avatar>
        
        <Typography variant="h4" gutterBottom>
          Mainstream Assistant
        </Typography>
        
        <Paper elevation={3} sx={{ p: 4, width: '100%', mt: 2 }}>
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center' }}>
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
                    {employees.map(emp => (
                      <Card 
                        key={emp}
                        onClick={() => setSelectedEmployee(emp)}
                        sx={{ 
                          flex: 1,
                          cursor: 'pointer',
                          border: selectedEmployee === emp ? '2px solid #7c9ebf' : '1px solid #e0e0e0',
                          bgcolor: selectedEmployee === emp ? '#f0f4f8' : 'white',
                          transition: 'all 0.2s',
                          '&:hover': { boxShadow: 2 }
                        }}
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
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
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