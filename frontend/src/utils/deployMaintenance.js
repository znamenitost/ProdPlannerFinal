/** Совпадает с AppOfflineMaintenancePage.Marker на бэкенде. */
export const DEPLOY_MAINTENANCE_MARKER = 'app-maintenance-v1';

export const DEPLOY_MAINTENANCE_EVENT = 'app-deploy-maintenance';

export function notifyDeployMaintenanceIfNeeded(body) {
  if (typeof body === 'string' && body.includes(DEPLOY_MAINTENANCE_MARKER)) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DEPLOY_MAINTENANCE_EVENT));
    }
    return true;
  }
  return false;
}

export function isDeployMaintenanceMessage(message) {
  if (typeof message !== 'string' || !message) return false;
  return message.includes(DEPLOY_MAINTENANCE_MARKER)
    || (message.includes('503') && message.includes('<!DOCTYPE html>'));
}

export function shortenHubLogMessage(message) {
  const text = String(message ?? '');
  if (isDeployMaintenanceMessage(text)) return 'Сервер в режиме обновления (503)';
  if (text.length > 240) return `${text.slice(0, 240)}…`;
  return text;
}
