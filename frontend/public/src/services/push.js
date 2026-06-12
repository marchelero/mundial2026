import { api } from './api.js';

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] No soportado en este navegador');
    return;
  }

  if (Notification.permission === 'denied') {
    console.log('[Push] Permiso denegado previamente');
    return;
  }

  if (Notification.permission === 'default') {
    console.log('[Push] Solicitando permiso...');
    const result = await Notification.requestPermission();
    console.log('[Push] Permiso:', result);
    if (result !== 'granted') return;
  }

  const vapidKey = typeof VAPID_PUBLIC_KEY !== 'undefined' ? VAPID_PUBLIC_KEY : '';
  if (!vapidKey) {
    console.warn('[Push] VAPID_PUBLIC_KEY no definida');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker ready');
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      //console.log('[Push] Suscripción existente, actualizando...');
      const subJson = existing.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });
      // console.log('[Push] Suscripción actualizada');
      return;
    }

    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    };

    // console.log('[Push] Creando nueva suscripción...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subJson = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });
    // console.log('[Push] Suscripción creada correctamente');
  } catch (e) {
    console.warn('[Push] Error de suscripción:', e.message);
  }
}
