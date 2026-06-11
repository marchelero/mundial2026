const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

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
    const now = new Date();
    const matchDt = new Date(match.date + 'T' + match.time);
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
  } catch (e) {
    res.status(500).json({ error: 'Error al crear pronóstico' });
  }
});

function formatPrediction(p) {
  return { id: p.id, user: p.user_id, match: p.match_id, home_score: p.home_score, away_score: p.away_score, comodin: !!p.comodin };
}

module.exports = router;
