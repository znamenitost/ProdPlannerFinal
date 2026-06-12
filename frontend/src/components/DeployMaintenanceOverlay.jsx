import {
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography
} from '@mui/material';
import ParallaxPage from './ParallaxPage';

export default function DeployMaintenanceOverlay() {
  return (
    <ParallaxPage className="lunch-break-overlay">
      <Container maxWidth="sm" className="login-content">
        <Box className="login-form-shell">
          <Paper variant="section" sx={{ p: 4, width: '100%', textAlign: 'center' }}>
            <Typography variant="h2" gutterBottom sx={{ mb: 1 }}>
              Приложение обновляется
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Подождите немного — после завершения деплоя страница обновится автоматически.
            </Typography>
            <CircularProgress aria-label="Обновление приложения" />
          </Paper>
        </Box>
      </Container>
    </ParallaxPage>
  );
}
