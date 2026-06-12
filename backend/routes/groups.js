const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Load group definitions from seed data
const seedPath = path.join(__dirname, '..', '..', 'data', 'seed_data.json');
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

router.get('/standings', authRequired, (req, res) => {
  try {
    const finishedMatches = db.prepare(`
      SELECT * FROM matches WHERE round = 'group' AND status = 'finished'
    `).all();

    const groups = seedData.groups.map(g => {
      // Initialize team stats
      const teams = {};
      for (const name of g.teams) {
        teams[name] = { name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
      }

      // Process finished matches
      for (const m of finishedMatches) {
        if (!teams[m.home_team] || !teams[m.away_team]) continue;
        const home = teams[m.home_team];
        const away = teams[m.away_team];

        home.pj++;
        away.pj++;
        home.gf += m.home_score;
        home.gc += m.away_score;
        away.gf += m.away_score;
        away.gc += m.home_score;

        if (m.home_score > m.away_score) {
          home.pg++;
          away.pp++;
          home.pts += 3;
        } else if (m.home_score < m.away_score) {
          away.pg++;
          home.pp++;
          away.pts += 3;
        } else {
          home.pe++;
          away.pe++;
          home.pts += 1;
          away.pts += 1;
        }
      }

      // Sort: points DESC, goal diff DESC, goals for DESC
      const sorted = Object.values(teams).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        const gdA = a.gf - a.gc;
        const gdB = b.gf - b.gc;
        if (gdB !== gdA) return gdB - gdA;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      });

      return {
        group: g.group,
        teams: sorted,
        played: sorted.some(t => t.pj > 0),
      };
    });

    res.json(groups);
  } catch (e) {
    console.error('Error al obtener standings:', e.message);
    res.status(500).json({ error: 'Error al obtener tabla de grupos' });
  }
});

module.exports = router;
