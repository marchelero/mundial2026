const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/rankings', authRequired, (req, res) => {
  try {
    // Base rankings: all users with their total_points
    const users = db.prepare(`
      SELECT id, email, name, COALESCE(total_points, 0) as points
      FROM users
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
      potential_points: potMap[u.id] || 0
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

module.exports = router;
