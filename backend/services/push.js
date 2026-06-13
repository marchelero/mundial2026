const webpush = require('web-push');
const { flagUrl } = require('../data/countries');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mundial2026.app';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function sendNotification(subscription, payload) {
  try {
    webpush.sendNotification(subscription, JSON.stringify(payload)).catch(err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log('[Push] Subscription expired/gone, should remove:', err.statusCode);
      } else {
        console.error('[Push] Error sending:', err.message);
      }
    });
  } catch (e) {
    console.error('[Push] Error:', e.message);
  }
}

function sendMatchResultPush(match, homeFlag, awayFlag, pointsSummary) {
  const total = pointsSummary.reduce((s, r) => s + r.count, 0);
  const title = `${homeFlag} ${match.home_team} ${match.home_score} - ${match.away_score} ${match.away_team} ${awayFlag}`;
  const body = `Resultado finalizado — ${total} pronóstico(s). Tocá para ver los detalles.`;

  const payload = {
    title,
    body,
    icon: flagUrl(homeFlag) || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    image: flagUrl(awayFlag) || undefined,
    data: {
      url: '/',
      matchId: match.id,
    },
  };

  const { db } = require('../db');
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }, payload);
  }
  console.log(`[Push] Sent to ${subscriptions.length} subscription(s)`);
}

function sendChampionPickPush(user, champion, flag) {
  const name = user.name || user.email?.split('@')[0] || 'Usuario';
  const title = `🏆 ${flag} ${champion}`;
  const body = `${name} eligió a ${champion} como campeón mundial.`;

  const payload = {
    title,
    body,
    icon: flagUrl(flag) || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
  };

  const { db } = require('../db');
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
  }
  console.log(`[Push] Champion pick sent to ${subscriptions.length} subscription(s)`);
}

function sendChampionAwardPush(winner, flag) {
  const title = `🏆 ${flag} ${winner} ES EL CAMPEÓN MUNDIAL 2026 🏆`;
  const body = `El campeón del mundo es ${winner}. Ingresá a la app para ver los resultados.`;

  const payload = {
    title,
    body,
    icon: flagUrl(flag) || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
  };

  const { db } = require('../db');
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
  }
  console.log(`[Push] Champion award sent to ${subscriptions.length} subscription(s)`);
}

function sendTestPush() {
  const payload = {
    title: '🔔 Notificación de Prueba',
    body: 'Si ves esto, las notificaciones push funcionan correctamente.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
  };

  const { db } = require('../db');
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
  }
  console.log(`[Push] Test sent to ${subscriptions.length} subscription(s)`);
  return subscriptions.length;
}

module.exports = { sendNotification, sendMatchResultPush, sendTestPush, sendChampionPickPush, sendChampionAwardPush };
