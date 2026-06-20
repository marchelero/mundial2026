const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { recalcAllTotals } = require('../services/scoring');

const router = express.Router();

router.get('/', authRequired, adminRequired, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name, google_id, created_at, COALESCE(total_points, 0) as total_points FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (e) {
    console.error('Error listing users:', e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/', authRequired, adminRequired, (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requerido' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const id = generateId();
    const userName = (name || '').trim() || cleanEmail.split('@')[0];
    db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, NULL, ?, ?)').run(id, cleanEmail, userName);
    const user = db.prepare('SELECT id, email, name, google_id, created_at FROM users WHERE id = ?').get(id);
    res.status(201).json(user);
  } catch (e) {
    console.error('Error creating user:', e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, google_id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.google_id) {
      return res.status(400).json({ error: 'No se puede eliminar un usuario que ya vinculó su cuenta de Google' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

router.put('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const { email, name } = req.body;
    const user = db.prepare('SELECT id, email, name, google_id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email requerido' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanEmail, user.id);
      if (existing) {
        return res.status(409).json({ error: 'El email ya está registrado por otro usuario' });
      }
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(cleanEmail, user.id);
    }

    if (name !== undefined) {
      const cleanName = (name || '').trim();
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, user.id);
    }

    const updated = db.prepare('SELECT id, email, name, google_id, created_at, COALESCE(total_points, 0) as total_points FROM users WHERE id = ?').get(user.id);
    res.json(updated);
  } catch (e) {
    console.error('Error updating user:', e);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.get('/unlinked', authRequired, adminRequired, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name FROM users WHERE google_id IS NULL ORDER BY email ASC').all();
    res.json(users);
  } catch (e) {
    console.error('Error listing unlinked users:', e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/rankings', authRequired, (req, res) => {
  try {
    // Base rankings: all users with their total_points
    const users = db.prepare(`
      SELECT id, email, name, COALESCE(total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines_usados,
        (SELECT COUNT(*) FROM predictions p JOIN matches m ON m.id = p.match_id
         WHERE p.user_id = u.id AND p.comodin = 1 AND m.status != 'finished') as comodines_pendientes
      FROM users u
      ORDER BY points DESC, email ASC
    `).all();

    // Potential points: predictions for unfinished matches WITH scores
    const potentials = db.prepare(`
      SELECT p.user_id,
        SUM(CASE
          WHEN p.home_score = m.home_score AND p.away_score = m.away_score
            THEN CASE WHEN p.comodin = 1 THEN 6 ELSE 3 END
          WHEN (p.home_score - p.away_score = m.home_score - m.away_score AND m.home_score - m.away_score = 0)
            OR (p.home_score - p.away_score > 0 AND m.home_score - m.away_score > 0)
            OR (p.home_score - p.away_score < 0 AND m.home_score - m.away_score < 0)
            THEN CASE WHEN p.comodin = 1 THEN 2 ELSE 1 END
          ELSE 0
        END) as pts
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
        AND m.status != 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
      GROUP BY p.user_id
    `).all();

    // Build lookup
    const potMap = {};
    for (const p of potentials) potMap[p.user_id] = p.pts || 0;

    // Merge and sort by total + potential
    const result = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      points: u.points,
      potential_points: potMap[u.id] || 0,
      comodin_usado: (u.comodines_usados || 0) > 0,
      comodines_usados: u.comodines_usados || 0,
      comodines_pendientes: u.comodines_pendientes || 0
    })).sort((a, b) => {
      const diff = (b.points + b.potential_points) - (a.points + a.potential_points);
      return diff !== 0 ? diff : a.email.localeCompare(b.email);
    });

    res.json(result);
  } catch (e) {
    console.error('Rankings error:', e);
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

router.post('/recalculate-totals', authRequired, adminRequired, (req, res) => {
  try {
    const result = recalcAllTotals();
    console.log('[Recalc]', result);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Recalculate totals error:', e);
    res.status(500).json({ error: 'Error al recalcular totales: ' + e.message });
  }
});

module.exports = router;
