/**
 * Режим выдачи: ввод номера нормализуется («и 11» → «И11»),
 * строки сортируются: буква указателя → заказчик → цифровая часть номера.
 */

export function normalizePickupQuery(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 8);
}

function parsePickupCode(code) {
  const normalized = String(code ?? '').trim().toUpperCase();
  const match = normalized.match(/^(\D+?)(\d+)?$/);
  if (!match) return { letter: normalized, digits: null };
  return {
    letter: match[1] || '',
    digits: match[2] != null ? parseInt(match[2], 10) : null
  };
}

export function comparePickupRows(a, b) {
  const codeA = parsePickupCode(a?.pickupCode);
  const codeB = parsePickupCode(b?.pickupCode);

  // Строки без номера — в конец таблицы выдачи.
  const hasCodeA = Boolean(String(a?.pickupCode ?? '').trim());
  const hasCodeB = Boolean(String(b?.pickupCode ?? '').trim());
  if (hasCodeA !== hasCodeB) return hasCodeA ? -1 : 1;

  const letterDiff = codeA.letter.localeCompare(codeB.letter, 'ru');
  if (letterDiff) return letterDiff;

  const customerDiff = String(a?.customerName ?? '').localeCompare(String(b?.customerName ?? ''), 'ru');
  if (customerDiff) return customerDiff;

  const digitsA = codeA.digits ?? Number.POSITIVE_INFINITY;
  const digitsB = codeB.digits ?? Number.POSITIVE_INFINITY;
  if (digitsA !== digitsB) return digitsA - digitsB;

  return (a?.id ?? 0) - (b?.id ?? 0);
}
