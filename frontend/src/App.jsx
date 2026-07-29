import { lazy, Suspense, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import LoginForm from './components/LoginForm';
import { LoadingState } from './components/LoadingState';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './hooks/useAuth';
import appTheme from './theme/appTheme';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));
const CustomerOrderPage = lazy(() => import('./components/CustomerOrderPage'));
const CatalogPage = lazy(() => import('./catalog/CatalogPage'));
const ProductPage = lazy(() => import('./catalog/ProductPage'));
const CartPage = lazy(() => import('./catalog/CartPage'));
const CatalogAdminPage = lazy(() => import('./catalog/CatalogAdminPage'));
const CatalogAdminProductPage = lazy(() => import('./catalog/CatalogAdminProductPage'));

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
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <CustomerOrderPage token={publicRoute.token} />
      </Suspense>
    );
  }

  if (publicRoute?.type === 'catalog-admin') {
    if (authChecking) return <LoadingState fullScreen />;
    if (!user) return <LoginForm onLogin={handleLogin} />;
    if (user.role !== 'Admin') return <CatalogAdminForbidden />;
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <CatalogAdminPage />
      </Suspense>
    );
  }

  if (publicRoute?.type === 'catalog-admin-product') {
    if (authChecking) return <LoadingState fullScreen />;
    if (!user) return <LoginForm onLogin={handleLogin} />;
    if (user.role !== 'Admin') return <CatalogAdminForbidden />;
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <CatalogAdminProductPage productId={publicRoute.id} />
      </Suspense>
    );
  }

  if (publicRoute?.type === 'catalog') {
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <CatalogPage />
      </Suspense>
    );
  }

  if (publicRoute?.type === 'product') {
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <ProductPage slug={publicRoute.slug} />
      </Suspense>
    );
  }

  if (publicRoute?.type === 'cart') {
    return (
      <Suspense fallback={<LoadingState fullScreen />}>
        <CartPage />
      </Suspense>
    );
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
