const KEY = 'pp.catalog.cart.v1';

export function readCart() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('catalog-cart-changed'));
}

export function addCartItem(item) {
  const items = readCart();
  const idx = items.findIndex(
    (x) => x.productId === item.productId && x.variantId === item.variantId
  );
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      quantity: items[idx].quantity + item.quantity,
      mockupTransformJson: item.mockupTransformJson ?? items[idx].mockupTransformJson,
      logoFileUrl: item.logoFileUrl ?? items[idx].logoFileUrl
    };
  } else {
    items.push(item);
  }
  writeCart(items);
  return items;
}

export function updateCartItemQuantity(productId, variantId, quantity) {
  const items = readCart()
    .map((x) =>
      x.productId === productId && x.variantId === variantId
        ? { ...x, quantity }
        : x
    )
    .filter((x) => x.quantity > 0);
  writeCart(items);
  return items;
}

export function removeCartItem(productId, variantId) {
  const items = readCart().filter(
    (x) => !(x.productId === productId && x.variantId === variantId)
  );
  writeCart(items);
  return items;
}

export function clearCart() {
  writeCart([]);
}

export function cartCount(items = readCart()) {
  return items.reduce((sum, x) => sum + (x.quantity || 0), 0);
}
