import { useEffect, useState } from 'react';
import {
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Typography
} from '@mui/material';
import { ShoppingBagOutlined as ShoppingBagOutlinedIcon } from '@mui/icons-material';
import { pageShellSx } from '../theme/surfaces';
import { cartCount, readCart } from './cartStorage';

export default function CatalogShell({ children, title = 'Каталог', dense = false }) {
  const [count, setCount] = useState(() => cartCount());

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    window.addEventListener('catalog-cart-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('catalog-cart-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <Box
      sx={{
        ...pageShellSx,
        ...(dense ? { py: { xs: 1, md: 1.5 }, minHeight: '100dvh' } : null)
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          bgcolor: 'rgba(250,251,253,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: dense ? 1 : 2
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: dense ? 48 : 56, gap: 1 }}>
            <Typography
              component="a"
              href="/catalog"
              variant="h2"
              sx={{
                flex: 1,
                textDecoration: 'none',
                color: 'text.primary',
                fontSize: '1.05rem'
              }}
            >
              {title}
            </Typography>
            <Button
              href="/catalog/admin"
              size="small"
              variant="outlined"
              color="primary"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Админка
            </Button>
            <IconButton
              href="/cart"
              aria-label="Корзина"
              color="primary"
              size="small"
            >
              <Badge badgeContent={count} color="primary" max={99}>
                <ShoppingBagOutlinedIcon />
              </Badge>
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ pb: dense ? 2 : 6 }}>
        {children}
      </Container>
    </Box>
  );
}
