import { lazy, Suspense } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import LoginForm from './components/LoginForm';
import { LoadingState } from './components/LoadingState';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './hooks/useAuth';
import appTheme from './theme/appTheme';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));

function AppContent() {
  const { user, handleLogin } = useAuth();

  if (!user) return <LoginForm onLogin={handleLogin} />;

  return (
    <Suspense fallback={<LoadingState fullScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
