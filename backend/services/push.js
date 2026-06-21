// Servicio de Push Notifications.
// IMPORTANTE: las funciones de envío verifican isPushEnabled() antes de mandar.
// En desarrollo/localhost las notificaciones se LOGUEAN pero NO se envían, así
// no se disparan pushes accidentales a usuarios de producción.
const webpush = require('web-push');
const { flagUrl } = require('../data/countries');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mundial2026.app';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

// Gate principal: solo manda en producción, salvo override explícito.
// - PUSH_ENABLED=false  → desactiva en cualquier entorno
// - PUSH_ENABLED=true   → fuerza activación incluso en dev (útil para tests)
// - sin la var          → solo activo si NODE_ENV=production
function isPushEnabled() {
  const flag = (process.env.PUSH_ENABLED || '').toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.NODE_ENV === 'production';
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

function pushToAll(payload) {
  const { db } = require('../db');
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
  }
  return subscriptions.length;
}

function sendMatchResultPush(match, homeFlag, awayFlag, pointsSummary) {
  const total = pointsSummary.reduce((s, r) => s + r.count, 0);
  const title = `${match.home_team} ${match.home_score} - ${match.away_score} ${match.away_team}`;
  const body = `Resultado finalizado — ${total} pronóstico(s). Tocá para ver los detalles.`;

  const payload = {
    title,
    body,
    icon: flagUrl(homeFlag) || '/icons/icon-192.png',
    badge: flagUrl(awayFlag) || '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      matchId: match.id,
      homeFlagUrl: flagUrl(homeFlag),
      awayFlagUrl: flagUrl(awayFlag),
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      homeScore: match.home_score,
      awayScore: match.away_score,
      body,
    },
  };

  if (!isPushEnabled()) {
    console.log(`[Push] (DESHABILITADO) match=${match.id} title="${title}" → no se envía`);
    return 0;
  }
  const sent = pushToAll(payload);
  console.log(`[Push] Sent match result to ${sent} subscription(s) — ${title}`);
  return sent;
}

function sendChampionPickPush(user, champion, flag) {
  const name = user.name || user.email?.split('@')[0] || 'Usuario';
  const title = `🏆 ${champion}`;
  const body = `${name} eligió a ${champion} como campeón mundial.`;

  const payload = {
    title,
    body,
    icon: flagUrl(flag) || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/', flagUrl: flagUrl(flag), champion, body },
  };

  if (!isPushEnabled()) {
    console.log(`[Push] (DESHABILITADO) champion-pick user=${user.id} → no se envía`);
    return 0;
  }
  const sent = pushToAll(payload);
  console.log(`[Push] Champion pick sent to ${sent} subscription(s) — ${champion}`);
  return sent;
}

function sendChampionAwardPush(winner, flag) {
  const title = `🏆 ${winner} ES EL CAMPEÓN MUNDIAL 2026 🏆`;
  const body = `El campeón del mundo es ${winner}. Ingresá a la app para ver los resultados.`;

  const payload = {
    title,
    body,
    icon: flagUrl(flag) || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/', flagUrl: flagUrl(flag), champion: winner, body },
  };

  if (!isPushEnabled()) {
    console.log(`[Push] (DESHABILITADO) champion-award → no se envía`);
    return 0;
  }
  const sent = pushToAll(payload);
  console.log(`[Push] Champion award sent to ${sent} subscription(s) — ${winner}`);
  return sent;
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

  if (!isPushEnabled()) {
    console.log(`[Push] (DESHABILITADO) test → no se envía. Set PUSH_ENABLED=true para forzar el envío en dev.`);
    return 0;
  }
  const sent = pushToAll(payload);
  console.log(`[Push] Test sent to ${sent} subscription(s)`);
  return sent;
}

module.exports = {
  sendNotification,
  sendMatchResultPush,
  sendTestPush,
  sendChampionPickPush,
  sendChampionAwardPush,
  isPushEnabled,
};
