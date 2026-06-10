const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const matches = db.prepare('SELECT * FROM matches ORDER BY date, time').all();
    res.json(matches);
  } catch (e) {
    console.error('Error fetching matches:', e.message);
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

    if (home_score !== undefined && home_score !== null && (isNaN(home_score) || home_score < 0 || home_score > 99)) {
      return res.status(400).json({ error: 'El score del local debe estar entre 0 y 99' });
    }

    if (away_score !== undefined && away_score !== null && (isNaN(away_score) || away_score < 0 || away_score > 99)) {
      return res.status(400).json({ error: 'El score del visitante debe estar entre 0 y 99' });
    }

    const validRounds = ['group', 'round_32', 'round_16', 'quarter', 'semi', 'final'];
    if (round && !validRounds.includes(round)) {
      return res.status(400).json({ error: 'Ronda inválida' });
    }

    const validStatuses = ['open', 'closed', 'finished'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const id = generateId();
    db.prepare(
      'INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, date, time, home_team, away_team, home_score ?? null, away_score ?? null, status || 'open', round || 'group');
    
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    res.status(201).json(match);
  } catch (e) {
    console.error('Error creating match:', e.message);
    res.status(500).json({ error: 'Error al crear partido' });
  }
});

router.patch('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const allowedFields = ['date', 'time', 'home_team', 'away_team', 'home_score', 'away_score', 'status', 'round'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'home_score' || field === 'away_score') {
          const val = req.body[field];
          if (val !== null && (isNaN(val) || val < 0 || val > 99)) {
            return res.status(400).json({ error: `${field} debe estar entre 0 y 99` });
          }
        }
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`).run(values);
    
    const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    console.error('Error updating match:', e.message);
    res.status(500).json({ error: 'Error al actualizar partido' });
  }
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const predictionsCount = db.prepare('SELECT COUNT(*) as count FROM predictions WHERE match_id = ?').get(req.params.id);
    if (predictionsCount.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un partido con pronósticos' });
    }

    db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (e) {
    console.error('Error deleting match:', e.message);
    res.status(500).json({ error: 'Error al eliminar partido' });
  }
});

module.exports = router;
