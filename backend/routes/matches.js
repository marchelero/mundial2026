const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { sendMatchResult } = require('../services/whatsapp');
const { flagEmoji } = require('../data/countries');
const { sendMatchResultPush } = require('../services/push');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const matches = db.prepare('SELECT * FROM matches ORDER BY date, time').all();
    res.json(matches);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener partidos' });
  }
});

router.post('/', authRequired, adminRequired, (req, res) => {
  try {
    const { date, time, home_team, away_team, round, home_score, away_score, status } = req.body;
    if (!date || !time || !home_team || !away_team) {
      return res.status(400).json({ error: 'Campos requeridos: date, time, home_team, away_team' });
    }
    if (home_team === away_team) {
      return res.status(400).json({ error: 'Los equipos deben ser diferentes' });
    }
    const id = generateId();
    db.prepare(
      'INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, date, time, home_team, away_team, home_score ?? null, away_score ?? null, status || 'open', round || 'group');
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    res.status(201).json(match);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear partido' });
  }
});

router.patch('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    const allowedFields = ['date', 'time', 'home_team', 'away_team', 'home_score', 'away_score', 'status', 'round'];
    const updates = [];
    const values = [];
    let transitioningToFinished = false;
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        if (field === 'status' && req.body[field] === 'finished') transitioningToFinished = true;
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });
    values.push(req.params.id);
    db.prepare(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`).run(values);

    if (transitioningToFinished) {
      const updatedMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
      if (updatedMatch.home_score != null && updatedMatch.away_score != null) {
        calcAndSavePoints(updatedMatch);
        // Build points summary and send WhatsApp
        const summary = db.prepare(`
          SELECT points, COUNT(*) as count FROM predictions
          WHERE match_id = ? AND points IS NOT NULL
          GROUP BY points ORDER BY points DESC
        `).all(updatedMatch.id);
        const homeFlag = flagEmoji(updatedMatch.home_team);
        const awayFlag = flagEmoji(updatedMatch.away_team);
        sendMatchResult(updatedMatch, homeFlag, awayFlag, summary);
        sendMatchResultPush(updatedMatch, homeFlag, awayFlag, summary);
      }
    }

    res.json(db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar partido' });
  }
});

function calcPointsForPred(predHome, predAway, actualHome, actualAway, comodin) {
  let pts = 0;
  if (predHome === actualHome && predAway === actualAway) {
    pts = 3;
  } else {
    const pd = predHome - predAway;
    const rd = actualHome - actualAway;
    if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) {
      pts = 1;
    }
  }
  return comodin ? pts * 2 : pts;
}

function calcAndSavePoints(match) {
  const predictions = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(match.id);
  const userIds = [];

  for (const pred of predictions) {
    const pts = calcPointsForPred(pred.home_score, pred.away_score, match.home_score, match.away_score, !!pred.comodin);
    db.prepare('UPDATE predictions SET points = ? WHERE id = ?').run(pts, pred.id);
    if (!userIds.includes(pred.user_id)) userIds.push(pred.user_id);
  }

  for (const userId of userIds) {
    const predPts = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM predictions WHERE user_id = ? AND points IS NOT NULL').get(userId);
    let total = predPts.total;
    try {
      const champPts = db.prepare('SELECT COALESCE(points, 0) as total FROM champion_picks WHERE user_id = ? AND points IS NOT NULL').get(userId);
      total += champPts ? champPts.total : 0;
    } catch (_) {}
    db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(total, userId);
  }
}

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    const cnt = db.prepare('SELECT COUNT(*) as c FROM predictions WHERE match_id = ?').get(req.params.id);
    if (cnt.c > 0) return res.status(400).json({ error: 'No se puede eliminar un partido con pronósticos' });
    db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar partido' });
  }
});

module.exports = router;
