export function avatarDisplayUrl(userId, { size = 128, cacheBust } = {}) {
  if (!userId) return undefined;

  const params = new URLSearchParams();
  params.set('w', String(size));
  if (cacheBust != null) params.set('t', String(cacheBust));

  return `/api/auth/avatar/${userId}?${params.toString()}`;
}
