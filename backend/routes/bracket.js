const express = require('express');
const { authRequired, adminRequired } = require('../middleware/auth');
const { initBracket, resetBracket, getQualifiersFromGroups } = require('../lib/bracket-init');
const { getBracket, propagateWinner, setTeam } = require('../lib/bracket-flow');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  try {
    const bracket = getBracket();
    res.json(bracket);
  } catch (e) {
    console.error('Get bracket error:', e);
    res.status(500).json({ error: 'Error al obtener bracket' });
  }
});

router.post('/init', authRequired, adminRequired, (req, res) => {
  try {
    const result = initBracket();
    res.json(result);
  } catch (e) {
    console.error('Init bracket error:', e);
    res.status(500).json({ error: 'Error al inicializar bracket' });
  }
});

router.post('/reset', authRequired, adminRequired, (req, res) => {
  try {
    const force = req.body?.force === true || req.query.force === '1' || req.query.force === 'true';
    const result = resetBracket(force);
    if (result.error) return res.status(400).json({ error: result.error, predictionsCount: result.predictionsCount });
    res.json(result);
  } catch (e) {
    console.error('Reset bracket error:', e);
    res.status(500).json({ error: 'Error al resetear bracket' });
  }
});

const { R32_FIXTURE, resolveFixtureSlot } = require('../lib/bracket-init');

router.post('/auto-fill', authRequired, adminRequired, (req, res) => {
  try {
    const result = getQualifiersFromGroups();
    const qualifiers = result.qualifiers;
    const standingsByGroup = result.standingsByGroup || {};
    const qualifiedThirds = qualifiers.filter(q => q.seed === 3).map(q => q.team);
    const warnings = [];
    if (qualifiers.length < 32) {
      warnings.push(`Solo ${qualifiers.length} equipos detectados, faltan ${32 - qualifiers.length} (grupos sin partidos finalizados?)`);
    }
    const { db } = require('../db');
    let assigned = 0;
    let placeholdersResolved = 0;
    let placeholdersRemaining = 0;
    for (const m of R32_FIXTURE) {
      const home = resolveFixtureSlot(m.home, standingsByGroup, qualifiedThirds);
      const away = resolveFixtureSlot(m.away, standingsByGroup, qualifiedThirds);
      const homeIsResolved = home && (!home.startsWith('1°') && !home.startsWith('2°') && !home.startsWith('3°'));
      const awayIsResolved = away && (!away.startsWith('1°') && !away.startsWith('2°') && !away.startsWith('3°'));
      if (homeIsResolved) assigned++; else if (home && home.includes('°')) placeholdersRemaining++;
      if (awayIsResolved) assigned++; else if (away && away.includes('°')) placeholdersRemaining++;
      if (home && home !== m.home) placeholdersResolved++;
      if (away && away !== m.away) placeholdersResolved++;
      db.prepare(`UPDATE bracket_matches SET home_team = ?, away_team = ? WHERE round = 'r32' AND position = ?`).run(
        home || m.home, away || m.away, m.pos
      );
    }
    const r32 = db.prepare("SELECT * FROM bracket_matches WHERE round = 'r32'").all();
    for (const m of r32) {
      if (m.match_id) {
        db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
          m.home_team || 'Por definir', m.away_team || 'Por definir', m.match_id
        );
      }
    }
    if (placeholdersRemaining > 0) {
      warnings.push(`${placeholdersRemaining} placeholder(s) del fixture no se pudieron resolver (faltan clasificados de algunos grupos)`);
    }
    res.json({ ok: true, assigned, placeholdersResolved, placeholdersRemaining, calculated: result.calculated, warnings });
  } catch (e) {
    console.error('Auto-fill error:', e);
    res.status(500).json({ error: 'Error al auto-llenar' });
  }
});

router.get('/qualifiers', authRequired, (req, res) => {
  try {
    const result = getQualifiersFromGroups();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener clasificados' });
  }
});

router.patch('/:id/team', authRequired, adminRequired, (req, res) => {
  try {
    const { slot, team, seed } = req.body;
    const result = setTeam(req.params.id, slot, team, seed);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al setear equipo' });
  }
});

router.post('/:id/winner', authRequired, adminRequired, (req, res) => {
  try {
    const { winner } = req.body;
    if (winner !== 'home' && winner !== 'away') {
      return res.status(400).json({ error: 'winner debe ser home o away' });
    }
    const result = propagateWinner(req.params.id, winner);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Set winner error:', e);
    res.status(500).json({ error: 'Error al marcar ganador' });
  }
});

module.exports = router;
