import { describe, expect, it } from 'vitest';
import {
  DEPLOY_MAINTENANCE_MARKER,
  isDeployMaintenanceMessage,
  notifyDeployMaintenanceIfNeeded,
  shortenHubLogMessage
} from '../src/utils/deployMaintenance.js';

describe('deployMaintenance', () => {
  it('detects maintenance html marker', () => {
    expect(isDeployMaintenanceMessage(`<!-- ${DEPLOY_MAINTENANCE_MARKER} -->`)).toBe(true);
    expect(isDeployMaintenanceMessage('503 Status code')).toBe(false);
  });

  it('shortens maintenance hub errors', () => {
    const html = `<!DOCTYPE html><!-- ${DEPLOY_MAINTENANCE_MARKER} -->${'x'.repeat(500)}`;
    expect(shortenHubLogMessage(html)).toBe('Сервер в режиме обновления (503)');
  });

  it('dispatches maintenance event once marker found', () => {
    const events = [];
    const handler = () => events.push(true);
    window.addEventListener('app-deploy-maintenance', handler);
    try {
      expect(notifyDeployMaintenanceIfNeeded('ok')).toBe(false);
      expect(events).toHaveLength(0);
      expect(notifyDeployMaintenanceIfNeeded(`<!-- ${DEPLOY_MAINTENANCE_MARKER} -->`)).toBe(true);
      expect(events).toHaveLength(1);
    } finally {
      window.removeEventListener('app-deploy-maintenance', handler);
    }
  });
});
