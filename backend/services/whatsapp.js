const http = require('http');
const { flagEmoji } = require('../data/countries');

const API_HOST = process.env.WHATSAPP_HOST || 'localhost';
const API_PORT = process.env.WHATSAPP_PORT || 8080;
const API_PATH = process.env.WHATSAPP_PATH || '/message/sendText/teste';
const API_KEY = process.env.WHATSAPP_API_KEY || '75458825-888B-4536-B2F2-5B054D5F4C82';
const GROUP_NUMBER = process.env.WHATSAPP_GROUP || '120363409786684123@g.us';

// Gate para no mandar WhatsApp desde localhost/dev y evitar spamear al grupo real.
// WHATSAPP_ENABLED=false → off en cualquier env
// WHATSAPP_ENABLED=true  → on incluso en dev
// sin la var             → solo si NODE_ENV=production
function isWhatsAppEnabled() {
  const flag = (process.env.WHATSAPP_ENABLED || '').toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function formatPredictions(predictions) {
  const lines = predictions.map(p => {
    const homeFlag = flagEmoji(p.home_team);
    const awayFlag = flagEmoji(p.away_team);
    const comodin = p.comodin ? ' (COMODIN ACTIVO)' : '';
    return `${homeFlag} ${p.home_team} ${p.home_score} - ${p.away_score} ${p.away_team} ${awayFlag}${comodin}`;
  });
  return lines.join('\n');
}

function sendRaw(text) {
  if (!isWhatsAppEnabled()) {
    console.log(`[WhatsApp] (DESHABILITADO) → no se envía. Set WHATSAPP_ENABLED=true para forzar el envío en dev.`);
    return;
  }
  try {
    const body = JSON.stringify({
      number: GROUP_NUMBER,
      textMessage: { text },
    });

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[WhatsApp] Mensaje enviado`);
        } else {
          console.error(`[WhatsApp] Error ${res.statusCode}: ${data}`);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[WhatsApp] Error de conexión:`, e.message);
    });

    req.write(body);
    req.end();
  } catch (e) {
    console.error(`[WhatsApp] Error:`, e.message);
  }
}

function sendWhatsAppPredictions(user, predictions) {
  const name = user.name || user.email?.split('@')[0] || 'Usuario';
  const email = user.email || '';

  const predictionLines = formatPredictions(predictions);
  const count = predictions.length;

  const text = `⚽ *MUNDIAL 2026* ⚽\n` +
    `${predictionLines}\n` +
    `👤 ${name} (${email})`;

  sendRaw(text);
}

function sendChampionPick(user, champion, flag) {
  const name = user.name || user.email?.split('@')[0] || 'Usuario';
  const email = user.email || '';
  const text = `🏆 *CAMPEÓN MUNDIAL 2026* 🏆\n\n${flag} *${champion}*\n\n👤 ${name}\n📧 ${email}`;
  sendRaw(text);
}

function sendMatchResult(match, homeFlag, awayFlag, pointsSummary) {
  const total = pointsSummary.reduce((s, r) => s + r.count, 0);

  let summary = '';
  const groups = {};
  for (const r of pointsSummary) {
    groups[r.points] = r.count;
  }

  for (const pts of [6, 3, 2, 1, 0]) {
    if (groups[pts] && groups[pts] > 0) {
      summary += `+${pts} puntos: ${groups[pts]} persona(s)\n`;
    }
  }

  const text = `🏁 RESUMEN DEL PARTIDO 🏁\n` +
    `${homeFlag} ${match.home_team} ${match.home_score} - ${match.away_score} ${match.away_team} ${awayFlag}\n` +
    `Resumen de puntos:\n${summary}\n` +
    `👥 Total: ${total} pronóstico(s)`;

  sendRaw(text);
}

function sendChampionAward(winner, flag) {
  const text = `🏆 *CAMPEÓN MUNDIAL 2026* 🏆\n\n${flag} *${winner}*\n\nSe ha definido el campeón mundial. Revisá la app para más detalles.`;
  sendRaw(text);
}

module.exports = { sendWhatsAppPredictions, sendChampionPick, sendMatchResult, sendChampionAward, sendRaw, flagEmoji, isWhatsAppEnabled };
