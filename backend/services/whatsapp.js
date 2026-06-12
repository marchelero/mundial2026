const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 8080;
const API_PATH = '/message/sendText/teste';
const API_KEY = '96CF28F9329F-44A3-80DB-5190D7B27185';
const GROUP_NUMBER = '120363409786684123@g.us';

const COUNTRIES = [
  { name: 'Argentina', flag: '🇦🇷' }, { name: 'Bolivia', flag: '🇧🇴' },
  { name: 'Brasil', flag: '🇧🇷' }, { name: 'Chile', flag: '🇨🇱' },
  { name: 'Colombia', flag: '🇨🇴' }, { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Paraguay', flag: '🇵🇾' }, { name: 'Perú', flag: '🇵🇪' },
  { name: 'Uruguay', flag: '🇺🇾' }, { name: 'Venezuela', flag: '🇻🇪' },
  { name: 'México', flag: '🇲🇽' }, { name: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Canadá', flag: '🇨🇦' }, { name: 'Costa Rica', flag: '🇨🇷' },
  { name: 'Panamá', flag: '🇵🇦' }, { name: 'Honduras', flag: '🇭🇳' },
  { name: 'Jamaica', flag: '🇯🇲' }, { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'España', flag: '🇪🇸' }, { name: 'Alemania', flag: '🇩🇪' },
  { name: 'Francia', flag: '🇫🇷' }, { name: 'Italia', flag: '🇮🇹' },
  { name: 'Países Bajos', flag: '🇳🇱' }, { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Bélgica', flag: '🇧🇪' }, { name: 'Suiza', flag: '🇨🇭' },
  { name: 'Croacia', flag: '🇭🇷' }, { name: 'Dinamarca', flag: '🇩🇰' },
  { name: 'Suecia', flag: '🇸🇪' }, { name: 'Noruega', flag: '🇳🇴' },
  { name: 'Polonia', flag: '🇵🇱' }, { name: 'Ucrania', flag: '🇺🇦' },
  { name: 'Serbia', flag: '🇷🇸' }, { name: 'Turquía', flag: '🇹🇷' },
  { name: 'República Checa', flag: '🇨🇿' }, { name: 'Rumania', flag: '🇷🇴' },
  { name: 'Austria', flag: '🇦🇹' }, { name: 'Hungría', flag: '🇭🇺' },
  { name: 'Grecia', flag: '🇬🇷' }, { name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'Gales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' }, { name: 'Irlanda', flag: '🇮🇪' },
  { name: 'Marruecos', flag: '🇲🇦' }, { name: 'Senegal', flag: '🇸🇳' },
  { name: 'Nigeria', flag: '🇳🇬' }, { name: 'Camerún', flag: '🇨🇲' },
  { name: 'Ghana', flag: '🇬🇭' }, { name: 'Costa de Marfil', flag: '🇨🇮' },
  { name: 'Egipto', flag: '🇪🇬' }, { name: 'Túnez', flag: '🇹🇳' },
  { name: 'Argelia', flag: '🇩🇿' }, { name: 'Sudáfrica', flag: '🇿🇦' },
  { name: 'Arabia Saudita', flag: '🇸🇦' }, { name: 'Japón', flag: '🇯🇵' },
  { name: 'Corea del Sur', flag: '🇰🇷' }, { name: 'Australia', flag: '🇦🇺' },
  { name: 'Irán', flag: '🇮🇷' }, { name: 'Catar', flag: '🇶🇦' },
  { name: 'Emiratos Árabes Unidos', flag: '🇦🇪' },
  { name: 'Bosnia y Herzegovina', flag: '🇧🇦' },
  { name: 'Eslovaquia', flag: '🇸🇰' }, { name: 'Eslovenia', flag: '🇸🇮' },
  { name: 'Montenegro', flag: '🇲🇪' }, { name: 'Macedonia del Norte', flag: '🇲🇰' },
  { name: 'Albania', flag: '🇦🇱' }, { name: 'Georgia', flag: '🇬🇪' },
  { name: 'Islandia', flag: '🇮🇸' }, { name: 'Finlandia', flag: '🇫🇮' },
  { name: 'Rusia', flag: '🇷🇺' }, { name: 'Nueva Zelanda', flag: '🇳🇿' },
  { name: 'Fiyi', flag: '🇫🇯' }, { name: 'Tahití', flag: '🇵🇫' },
  { name: 'Nueva Caledonia', flag: '🇳🇨' }, { name: 'Islas Salomón', flag: '🇸🇧' },
  { name: 'Papúa Nueva Guinea', flag: '🇵🇬' },
];

function flagEmoji(teamName) {
  const c = COUNTRIES.find(x => x.name.toLowerCase() === teamName.toLowerCase());
  return c ? c.flag : '🏳️';
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
    const label = r.points === 6 ? '⭐ EXACTO + COMODÍN' :
      r.points === 3 ? '✅ EXACTO' :
        r.points === 2 ? '🍀 RESULTADO + COMODÍN' :
          r.points === 1 ? '📌 RESULTADO' :
            '❌ SIN PUNTOS';
    groups[r.points] = { label, count: r.count };
  }

  for (const pts of [6, 3, 2, 1, 0]) {
    const g = groups[pts];
    if (g && g.count > 0) {
      summary += `• ${g.label}: ${g.count} persona(s)\n`;
    }
  }

  const text = `🏁 *RESUMEN DEL PARTIDO* 🏁\n` +
    `${homeFlag} ${match.home_team} ${match.home_score} - ${match.away_score} ${match.away_team} ${awayFlag}\n` +
    `*Resumen de puntos:*\n${summary}\n` +
    `👥 Total: ${total} pronóstico(s)`;

  sendRaw(text);
}

module.exports = { sendWhatsAppPredictions, sendChampionPick, sendMatchResult, flagEmoji };
