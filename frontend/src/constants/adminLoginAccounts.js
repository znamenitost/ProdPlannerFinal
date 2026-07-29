/** Синхронизировано с Services/Auth/AuthAdmins.cs */
export const DEPLOY_PREPARE_ADMIN_FULL_NAME = 'Павел';

/** Павел всегда последний — в пикере занимает нижний ряд целиком. */
export const ADMIN_LOGIN_ACCOUNTS = [
  { fullName: 'Инна', email: 'inna@admin.com' },
  { fullName: 'Леша', email: 'lesha@admin.com' },
  { fullName: 'Максим', email: 'maxim@admin.com' },
  { fullName: 'Павел', email: 'pavel@admin.com' }
];

export function sortAdminLoginAccounts(admins) {
  if (!Array.isArray(admins) || admins.length === 0) return [];
  const featured = DEPLOY_PREPARE_ADMIN_FULL_NAME;
  const rest = admins.filter((a) => a.fullName !== featured);
  const pavel = admins.filter((a) => a.fullName === featured);
  return [...rest, ...pavel];
}
