const { db } = require('../db');
const { nowStr, APP_TZ } = require('../utils/datetime');
const { flagEmoji, flagUrl } = require('../data/countries');
const { sendNotification } = require('../services/push');
const { sendRaw } = require('../services/whatsapp');

function getSettingInt(key, defaultValue) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row || row.value == null) return defaultValue;
    const n = parseInt(row.value, 10);
    return Number.isFinite(n) && n > 0 ? n : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function addMinutes(dateStr, minutes) {
  const [d, t] = dateStr.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, da, hh, mm, 0));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes);
  const yy = dt.getUTCFullYear();
  const mox = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dax = String(dt.getUTCDate()).padStart(2, '0');
  const hhx = String(dt.getUTCHours()).padStart(2, '0');
  const mmx = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mox}-${dax} ${hhx}:${mmx}`;
}

function minutesBetween(aStr, bStr) {
  const toDate = (s) => {
    const [d, t] = s.split(' ');
    const [y, mo, da] = d.split('-').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return new Date(Date.UTC(y, mo - 1, da, hh, mm, 0));
  };
  return Math.round((toDate(bStr) - toDate(aStr)) / 60000);
}

function sendMatchReminderPush(match, minutesBefore) {
  const homeFlag = flagEmoji(match.home_team);
  const awayFlag = flagEmoji(match.away_team);
  const title = `⏰ ${homeFlag} ${match.home_team} vs ${match.away_team} ${awayFlag} en ${minutesBefore} min`;
  const body = `Arranca a las ${match.time} (Bolivia). ¡No te olvides de cargar tu pronóstico!`;

  const payload = {
    title,
    body,
    icon: flagUrl(homeFlag) || '/icons/icon-192.png',
    badge: flagUrl(awayFlag) || '/icons/icon-192.png',
    vibrate: [200, 100, 200, 200, 100, 200],
    data: {
      url: '/',
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      kickoff: `${match.date} ${match.time}`,
      reminder: true,
    },
  };

  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  for (const sub of subscriptions) {
    sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
  }
  return subscriptions.length;
}

function sendMatchReminderWhatsApp(match, minutesBefore) {
  const homeFlag = flagEmoji(match.home_team);
  const awayFlag = flagEmoji(match.away_team);
  const text = `⏰ *RECORDATORIO DE PRONÓSTICO* ⏰\n\n` +
    `${homeFlag} *${match.home_team}* vs *${match.away_team}* ${awayFlag}\n` +
    `🕒 Arranca a las *${match.time}* (Bolivia) — en *${minutesBefore} minutos*\n\n` +
    `📋 ¡No te olvides de cargar tu marcador en la app!`;

  sendRaw(text);
}

function sendMatchReminder(match, minutesBefore) {
  const pushCount = sendMatchReminderPush(match, minutesBefore);
  try {
    sendMatchReminderWhatsApp(match, minutesBefore);
  } catch (e) {
    console.error('[Reminder] WhatsApp error:', e.message);
  }
  console.log(`[Reminder] Match ${match.id} (${match.home_team} vs ${match.away_team}) — push:${pushCount}, whatsapp:group, minutes_before:${minutesBefore}`);
  return { pushCount };
}

function checkUpcomingMatches() {
  const now = nowStr();
  const minutesBefore = getSettingInt('match_reminder_minutes', 15);
  const windowStart = now;
  const windowEnd = addMinutes(now, minutesBefore + 1);

  const matches = db.prepare(
    "SELECT * FROM matches WHERE status = 'open' AND (date || ' ' || time) >= ? AND (date || ' ' || time) <= ?"
  ).all(windowStart, windowEnd);

  if (matches.length === 0) return;

  for (const m of matches) {
    const kickoff = `${m.date} ${m.time}`;
    const diff = minutesBetween(now, kickoff);
    if (diff < 0 || diff > minutesBefore) continue;

    const alreadySent = db.prepare('SELECT 1 FROM match_reminders WHERE match_id = ?').get(m.id);
    if (alreadySent) continue;

    try {
      sendMatchReminder(m, minutesBefore);
      db.prepare('INSERT INTO match_reminders (match_id, minutes_before) VALUES (?, ?)').run(m.id, minutesBefore);
    } catch (e) {
      console.error(`[Reminder] Error processing match ${m.id}:`, e.message);
    }
  }
}

let intervalHandle = null;
function start() {
  if (intervalHandle) return;
  console.log(`[Reminder] Cron job started (polling every 60s, default 15 min before kickoff)`);
  checkUpcomingMatches();
  intervalHandle = setInterval(checkUpcomingMatches, 60 * 1000);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { start, stop, checkUpcomingMatches, sendMatchReminder, addMinutes, minutesBetween, APP_TZ };
