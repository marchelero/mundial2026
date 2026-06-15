const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { nowStr } = require('../utils/datetime');
const { sendWhatsAppPredictions } = require('../services/whatsapp');
const { recalcAndSavePointsForMatch } = require('../services/scoring');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  try {
    const { user, match } = req.query;
    let predictions;
    if (user) {
      if (user !== req.user.id) {
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        if (!adminEmails.includes(req.user.email?.toLowerCase())) {
          return res.status(403).json({ error: 'No autorizado' });
        }
      }
      predictions = db.prepare('SELECT * FROM predictions WHERE user_id = ?').all(user);
    } else if (match) {
      predictions = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(match);
    } else {
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      if (adminEmails.includes(req.user.email?.toLowerCase())) {
        predictions = db.prepare('SELECT * FROM predictions').all();
      } else {
        predictions = db.prepare('SELECT * FROM predictions WHERE user_id = ?').all(req.user.id);
      }
    }
    res.json(predictions.map(formatPrediction));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener pronósticos' });
  }
});

router.get('/match/:matchId', authRequired, (req, res) => {
  try {
    const predictions = db.prepare(`
      SELECT p.*, u.id as u_id, u.email as u_email, u.name as u_name
      FROM predictions p JOIN users u ON p.user_id = u.id
      WHERE p.match_id = ?
    `).all(req.params.matchId);
    res.json(predictions.map(p => ({ ...formatPrediction(p), expand: { user: { id: p.u_id, email: p.u_email, name: p.u_name } } })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener pronósticos' });
  }
});

router.get('/rankings', authRequired, (req, res) => {
  try {
    const predictions = db.prepare(`
      SELECT p.*, u.id as u_id, u.email as u_email, u.name as u_name
      FROM predictions p JOIN users u ON p.user_id = u.id JOIN matches m ON p.match_id = m.id
      WHERE m.status = 'finished'
    `).all();
    res.json(predictions.map(p => ({ ...formatPrediction(p), expand: { user: { id: p.u_id, email: p.u_email, name: p.u_name } } })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

router.get('/export', authRequired, adminRequired, (req, res) => {
  try {
    const predictions = db.prepare(`
      SELECT p.*, u.id as u_id, u.email as u_email, u.name as u_name,
             m.id as m_id, m.home_team, m.away_team, m.home_score as m_home_score, 
             m.away_score as m_away_score, m.date as m_date, m.time as m_time, 
             m.round as m_round, m.status as m_status
      FROM predictions p JOIN users u ON p.user_id = u.id JOIN matches m ON p.match_id = m.id
      ORDER BY u.email, m.date, m.time
    `).all();
    res.json(predictions.map(p => ({
      ...formatPrediction(p),
      expand: {
        user: { id: p.u_id, email: p.u_email, name: p.u_name },
        match: { id: p.m_id, home_team: p.home_team, away_team: p.away_team, home_score: p.m_home_score, away_score: p.m_away_score, date: p.m_date, time: p.m_time, round: p.m_round, status: p.m_status }
      }
    })));
  } catch (e) {
    res.status(500).json({ error: 'Error al exportar' });
  }
});

router.post('/', authRequired, (req, res) => {
  try {
    const { match: matchId, home_score, away_score, comodin } = req.body;
    if (matchId == null || home_score == null || away_score == null) {
      return res.status(400).json({ error: 'Campos requeridos: match, home_score, away_score' });
    }
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    if (match.status === 'finished' || match.status === 'closed') {
      return res.status(400).json({ error: `"${match.home_team} vs ${match.away_team}" ya finalizó` });
    }
    const now = nowStr();
    const matchDt = match.date + ' ' + match.time;
    if (now >= matchDt) {
      return res.status(400).json({ error: `"${match.home_team} vs ${match.away_team}" — el tiempo para pronosticar expiró` });
    }
    const existing = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.user.id, matchId);
    if (existing) return res.status(409).json({ error: 'Ya tienes pronóstico' });
    const id = generateId();
    db.prepare('INSERT INTO predictions (id, user_id, match_id, home_score, away_score, comodin) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.user.id, matchId, home_score, away_score, comodin ? 1 : 0);
    const pred = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id);
    res.status(201).json(formatPrediction(pred));
    // WhatsApp notification (non-blocking)
    sendWhatsAppPredictions(req.user, [{
      home_team: match.home_team,
      away_team: match.away_team,
      home_score,
      away_score,
      comodin: !!comodin,
    }]);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear pronóstico' });
  }
});

function formatPrediction(p) {
  return { id: p.id, user: p.user_id, match: p.match_id, home_score: p.home_score, away_score: p.away_score, comodin: !!p.comodin, points: p.points ?? null };
}

router.post('/admin-bulk', authRequired, adminRequired, (req, res) => {
  try {
    const items = req.body.predictions;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de pronósticos' });
    }
    const matchId = req.body.match_id;
    if (!matchId) return res.status(400).json({ error: 'match_id requerido' });

    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    const upsertOne = db.prepare(`
      INSERT INTO predictions (id, user_id, match_id, home_score, away_score, comodin)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(user_id, match_id) DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score
    `);

    const results = [];
    const errors = [];
    const affectedUserIds = new Set();

    const runBatch = db.transaction(() => {
      for (const item of items) {
        const { user_id, home_score, away_score } = item;
        if (!user_id || home_score == null || away_score == null) {
          errors.push({ user_id, error: 'Campos incompletos' }); continue;
        }
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
        if (!user) { errors.push({ user_id, error: 'Usuario no encontrado' }); continue; }
        upsertOne.run(generateId(), user_id, matchId, home_score, away_score);
        affectedUserIds.add(user_id);
        results.push({ user_id, match_id: matchId, home_score, away_score });
      }
    });

    runBatch();

    let recalculated = null;
    if (match.status === 'finished' && match.home_score != null && match.away_score != null) {
      recalculated = recalcAndSavePointsForMatch(matchId);
    }

    res.json({ saved: results, errors, recalculated });
  } catch (e) {
    console.error('Admin bulk error:', e);
    res.status(500).json({ error: 'Error al guardar pronósticos' });
  }
});

router.post('/batch', authRequired, (req, res) => {
  try {
    const items = req.body.predictions;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de pronósticos' });
    }
    const results = [];
    const errors = [];

    const insertOne = db.prepare(`
      INSERT INTO predictions (id, user_id, match_id, home_score, away_score, comodin)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const runBatch = db.transaction(() => {
      for (const item of items) {
        const { match: matchId, home_score, away_score, comodin } = item;
        if (!matchId || home_score == null || away_score == null) {
          errors.push({ match: matchId, error: 'Campos incompletos' }); continue;
        }
        const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
        if (!match) { errors.push({ match: matchId, error: 'Partido no encontrado' }); continue; }
        if (match.status === 'finished' || match.status === 'closed') {
          errors.push({ match: matchId, error: `"${match.home_team} vs ${match.away_team}" ya finalizó` }); continue;
        }
        const now = nowStr();
        const matchDt = match.date + ' ' + match.time;
        if (now >= matchDt) {
          errors.push({ match: matchId, error: `"${match.home_team} vs ${match.away_team}" — tiempo expiró` }); continue;
        }
        const existing = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.user.id, matchId);
        if (existing) { errors.push({ match: matchId, error: 'Ya tienes un pronóstico para este partido' }); continue; }
        const id = generateId();
        insertOne.run(id, req.user.id, matchId, home_score, away_score, comodin ? 1 : 0);
        results.push({ id, match: matchId, home_score, away_score, comodin: !!comodin });
      }
    });

    runBatch();
    res.json({ saved: results, errors });
    // WhatsApp notification (non-blocking)
    if (results.length > 0) {
      const wppPreds = results.map(r => {
        const m = db.prepare('SELECT home_team, away_team FROM matches WHERE id = ?').get(r.match);
        return m ? { home_team: m.home_team, away_team: m.away_team, home_score: r.home_score, away_score: r.away_score, comodin: r.comodin } : null;
      }).filter(Boolean);
      if (wppPreds.length > 0) sendWhatsAppPredictions(req.user, wppPreds);
    }
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar pronósticos' });
  }
});

module.exports = router;
