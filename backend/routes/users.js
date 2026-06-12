const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/rankings', authRequired, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        u.id, u.email, u.name, u.total_points,
        COALESCE(SUM(
          CASE
            WHEN p.home_score = m.home_score AND p.away_score = m.away_score
              THEN CASE WHEN p.comodin = 1 THEN 6 ELSE 3 END
            WHEN (p.home_score - p.away_score = m.home_score - m.away_score AND m.home_score - m.away_score = 0)
              OR (p.home_score - p.away_score > 0 AND m.home_score - m.away_score > 0)
              OR (p.home_score - p.away_score < 0 AND m.home_score - m.away_score < 0)
              THEN CASE WHEN p.comodin = 1 THEN 2 ELSE 1 END
            ELSE 0
          END
        ), 0) as potential_points
      FROM users u
      LEFT JOIN predictions p ON p.user_id = u.id
      LEFT JOIN matches m ON m.id = p.match_id
        AND m.status != 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
      GROUP BY u.id
      ORDER BY (u.total_points + COALESCE(SUM(
        CASE
          WHEN p.home_score = m.home_score AND p.away_score = m.away_score
            THEN CASE WHEN p.comodin = 1 THEN 6 ELSE 3 END
          WHEN (p.home_score - p.away_score = m.home_score - m.away_score AND m.home_score - m.away_score = 0)
            OR (p.home_score - p.away_score > 0 AND m.home_score - m.away_score > 0)
            OR (p.home_score - p.away_score < 0 AND m.home_score - m.away_score < 0)
            THEN CASE WHEN p.comodin = 1 THEN 2 ELSE 1 END
          ELSE 0
        END
      ), 0)) DESC, u.email ASC
    `).all();
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      points: u.total_points || 0,
      potential_points: u.potential_points || 0
    })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

module.exports = router;
