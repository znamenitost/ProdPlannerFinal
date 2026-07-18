import { useEffect } from 'react';
import { getPushConfig, subscribePush } from '../services/api';

function supportsWebPush() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers service worker and subscribes to Web Push (chat / tasks / comments)
 * for delivery when the tab has no SignalR connection.
 */
export default function useWebPush(user, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || !user?.isAuthenticated || !supportsWebPush()) return undefined;

    let cancelled = false;

    const setup = async () => {
      try {
        const config = await getPushConfig();
        if (cancelled || !config?.publicKey) return;

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        if (cancelled) return;

        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted' || cancelled) return;

        const existing = await registration.pushManager.getSubscription();
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey)
        });

        const json = subscription.toJSON();
        const endpoint = json.endpoint;
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;
        if (!endpoint || !p256dh || !auth) return;

        await subscribePush({ endpoint, p256dh, auth });
      } catch (err) {
        console.warn('Web Push setup failed:', err?.message ?? err);
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id, user?.isAuthenticated]);
}
