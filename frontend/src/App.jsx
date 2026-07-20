import { lazy, Suspense, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import LoginForm from './components/LoginForm';
import CustomerOrderPage from './components/CustomerOrderPage';
import { LoadingState } from './components/LoadingState';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './hooks/useAuth';
import appTheme from './theme/appTheme';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));

function readCustomerOrderToken() {
  const match = window.location.pathname.match(/^\/t\/([A-Za-z0-9_-]+)$/);
  return match ? match[1] : null;
}

function AppContent() {
  const { user, handleLogin, authChecking } = useAuth();
  const orderToken = useMemo(() => readCustomerOrderToken(), []);

  if (orderToken) {
    return <CustomerOrderPage token={orderToken} />;
  }

  if (authChecking) {
    return <LoadingState fullScreen />;
  }

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
