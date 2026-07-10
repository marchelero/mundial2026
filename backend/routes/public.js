const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { nowStr } = require('../utils/datetime');


const FLAG_MAP = {
  'Canadá': '🇨🇦', 'México': '🇲🇽', 'Estados Unidos': '🇺🇸',
  'Australia': '🇦🇺', 'Irak': '🇮🇶', 'Irán': '🇮🇷', 'Japón': '🇯🇵', 'Jordania': '🇯🇴',
  'Corea del Sur': '🇰🇷', 'Catar': '🇶🇦', 'Arabia Saudita': '🇸🇦', 'Uzbekistán': '🇺🇿',
  'Argelia': '🇩🇿', 'Cabo Verde': '🇨🇻', 'Congo DR': '🇨🇩', 'Costa de Marfil': '🇨🇮',
  'Egipto': '🇪🇬', 'Ghana': '🇬🇭', 'Marruecos': '🇲🇦', 'Senegal': '🇸🇳',
  'Sudáfrica': '🇿🇦', 'Túnez': '🇹🇳',
  'Curazao': '🇨🇼', 'Haití': '🇭🇹', 'Panamá': '🇵🇦',
  'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨',
  'Paraguay': '🇵🇾', 'Uruguay': '🇺🇾',
  'Nueva Zelanda': '🇳🇿',
  'Alemania': '🇩🇪', 'Austria': '🇦🇹', 'Bélgica': '🇧🇪', 'Bosnia y Herzegovina': '🇧🇦',
  'Croacia': '🇭🇷', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'España': '🇪🇸', 'Francia': '🇫🇷',
  'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Italia': '🇮🇹', 'Noruega': '🇳🇴', 'Países Bajos': '🇳🇱',
  'Portugal': '🇵🇹', 'República Checa': '🇨🇿', 'Suecia': '🇸🇪', 'Suiza': '🇨🇭', 'Turquía': '🇹🇷',
};

function flagFor(teamName) {
  return FLAG_MAP[teamName] || '🏴';
}

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes' }
});

router.get('/landing-data', publicLimiter, (req, res) => {
  try {
    const stats = {
      participantes: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      partidos: db.prepare('SELECT COUNT(*) as c FROM matches').get().c,
      jugados: db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'finished'`).get().c,
    };

    const proximoRow = db.prepare(`
      SELECT id, date, time, home_team, away_team FROM matches
      WHERE status = 'open' AND (date || ' ' || time) >= ?
      ORDER BY date ASC, time ASC LIMIT 1
    `).get(nowStr());

    stats.proximo = proximoRow ? {
      date: proximoRow.date,
      time: proximoRow.time,
      home_team: proximoRow.home_team,
      away_team: proximoRow.away_team,
      home_flag: flagFor(proximoRow.home_team),
      away_flag: flagFor(proximoRow.away_team),
    } : null;

    const rankingsRaw = db.prepare(`
      SELECT id, name, COALESCE(total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines_usados
      FROM users u
      ORDER BY points DESC, name ASC
    `).all();

    const rankings = rankingsRaw.map(r => ({
      id: r.id,
      name: r.name,
      points: r.points,
      comodines_usados: r.comodines_usados || 0,
    }));

    const finishedMatches = db.prepare(`
      SELECT id, date, time, home_team, away_team, home_score, away_score, round
      FROM matches WHERE status = 'finished'
      ORDER BY date ASC, time ASC
    `).all().map(m => ({
      ...m,
      home_flag: flagFor(m.home_team),
      away_flag: flagFor(m.away_team),
    }));

    const predictions = db.prepare(`
      SELECT match_id, user_id, home_score, away_score, points, comodin
      FROM predictions
      WHERE match_id IN (SELECT id FROM matches WHERE status = 'finished')
    `).all();

    res.json({ stats, rankings, finishedMatches, predictions });
  } catch (e) {
    console.error('[public/landing-data]', e);
    res.status(500).json({ error: 'No se pudo cargar la landing' });
  }
});

router.get('/champion-winner', publicLimiter, (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='champion_winner'").get();
    res.json({ champion_winner: (row && row.value) ? row.value : '' });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener campeón' });
  }
});

module.exports = router;
