import { api } from "./api";

let VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function ensureVapidKey() {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const res = await api.get('/push/vapid-key');
    VAPID_PUBLIC_KEY = res.data.vapid_public_key || "";
  } catch (e) {}
  return VAPID_PUBLIC_KEY;
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const vapidKey = await ensureVapidKey();
  if (!vapidKey) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
      const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
      await api.post('/push/subscribe', {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth }
      });
      return subscription;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    if (!p256dhKey || !authKey) return null;

    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(p256dhKey),
        auth: arrayBufferToBase64Url(authKey)
      }
    });
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
      } catch (e) {}
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}
