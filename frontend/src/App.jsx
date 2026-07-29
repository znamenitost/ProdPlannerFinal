import { lazy, Suspense, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import LoginForm from './components/LoginForm';
import CustomerOrderPage from './components/CustomerOrderPage';
import CatalogPage from './catalog/CatalogPage';
import ProductPage from './catalog/ProductPage';
import CartPage from './catalog/CartPage';
import CatalogAdminPage from './catalog/CatalogAdminPage';
import CatalogAdminProductPage from './catalog/CatalogAdminProductPage';
import { LoadingState } from './components/LoadingState';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './hooks/useAuth';
import appTheme from './theme/appTheme';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));

function readPublicRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  const orderMatch = path.match(/^\/t\/([A-Za-z0-9_-]+)$/);
  if (orderMatch) return { type: 'order', token: orderMatch[1] };

  if (path === '/catalog/admin') return { type: 'catalog-admin' };

  const adminProduct = path.match(/^\/catalog\/admin\/products\/(\d+)$/);
  if (adminProduct) return { type: 'catalog-admin-product', id: Number(adminProduct[1]) };

  if (path === '/catalog') return { type: 'catalog' };

  const productMatch = path.match(/^\/catalog\/([^/]+)$/);
  if (productMatch) return { type: 'product', slug: decodeURIComponent(productMatch[1]) };

  if (path === '/cart') return { type: 'cart' };

  return null;
}

function CatalogAdminForbidden() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <p>Доступ только для Admin.</p>
      <a href="/catalog">← В каталог</a>
    </div>
  );
}

function AppContent() {
  const { user, handleLogin, authChecking } = useAuth();
  const publicRoute = useMemo(() => readPublicRoute(), []);

  if (publicRoute?.type === 'order') {
    return <CustomerOrderPage token={publicRoute.token} />;
  }

  if (publicRoute?.type === 'catalog-admin') {
    if (authChecking) return <LoadingState fullScreen />;
    if (!user) return <LoginForm onLogin={handleLogin} />;
    if (user.role !== 'Admin') return <CatalogAdminForbidden />;
    return <CatalogAdminPage />;
  }

  if (publicRoute?.type === 'catalog-admin-product') {
    if (authChecking) return <LoadingState fullScreen />;
    if (!user) return <LoginForm onLogin={handleLogin} />;
    if (user.role !== 'Admin') return <CatalogAdminForbidden />;
    return <CatalogAdminProductPage productId={publicRoute.id} />;
  }

  if (publicRoute?.type === 'catalog') {
    return <CatalogPage />;
  }

  if (publicRoute?.type === 'product') {
    return <ProductPage slug={publicRoute.slug} />;
  }

  if (publicRoute?.type === 'cart') {
    return <CartPage />;
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
