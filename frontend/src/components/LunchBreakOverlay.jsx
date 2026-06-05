import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Typography
} from '@mui/material';
import { AdminPanelSettings, Person, SwitchAccount, TaskAlt } from '@mui/icons-material';
import ParallaxPage from './ParallaxPage';

export default function LunchBreakOverlay({
  user,
  avatarUrl,
  onAvatarError,
  onSwitchUser,
  onEndLunch,
  lunchPending
}) {
  const isAdmin = user?.role === 'Admin';

  return (
    <ParallaxPage className="lunch-break-overlay">
      <Container maxWidth="sm" className="login-content">
        <Box className="login-form-shell">
          <Paper variant="section" sx={{ p: 4, width: '100%', textAlign: 'center' }}>
            <Typography variant="h2" gutterBottom sx={{ mb: 1 }}>
              Обед
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Приятного аппетита! Когда вернётесь — нажмите «Пообедал».
            </Typography>

            <Avatar
              src={avatarUrl}
              sx={{ width: 96, height: 96, fontSize: '2rem', bgcolor: 'primary.main', mx: 'auto', mb: 2 }}
              onError={onAvatarError}
            >
              {!user?.avatarUrl && (user?.fullName?.[0] || 'U')}
            </Avatar>

            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {user?.fullName}
            </Typography>

            <Chip
              size="small"
              color={isAdmin ? 'warning' : 'info'}
              variant="outlined"
              icon={isAdmin
                ? <AdminPanelSettings sx={{ fontSize: '0.85rem !important' }} />
                : <Person sx={{ fontSize: '0.85rem !important' }} />}
              label={isAdmin ? 'Администратор' : 'Сотрудник'}
              sx={{ mb: 3, fontSize: '0.65rem' }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                fullWidth
                startIcon={<TaskAlt />}
                onClick={onEndLunch}
                disabled={lunchPending}
                loading={lunchPending}
              >
                Пообедал
              </Button>

              <Button
                variant="outlined"
                size="medium"
                fullWidth
                startIcon={<SwitchAccount />}
                onClick={onSwitchUser}
                disabled={lunchPending}
              >
                Сменить пользователя
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </ParallaxPage>
  );
}
