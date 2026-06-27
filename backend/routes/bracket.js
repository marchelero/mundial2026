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
    const result = resetBracket();
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error('Reset bracket error:', e);
    res.status(500).json({ error: 'Error al resetear bracket' });
  }
});

router.post('/auto-fill', authRequired, adminRequired, (req, res) => {
  try {
    const result = getQualifiersFromGroups();
    const qualifiers = result.qualifiers;
    const warnings = [];
    if (qualifiers.length < 32) {
      warnings.push(`Solo ${qualifiers.length} equipos detectados, faltan ${32 - qualifiers.length} (grupos sin partidos finalizados?)`);
    }
    const { db } = require('../db');
    let assigned = 0;
    for (let i = 0; i < 32; i++) {
      const slot = i % 2 === 0 ? 'home' : 'away';
      const pos = Math.floor(i / 2) + 1;
      const q = qualifiers[i];
      if (q) {
        db.prepare(`UPDATE bracket_matches SET ${slot}_team = ?, ${slot}_seed = ? WHERE round = 'r32' AND position = ?`).run(q.team, q.seed, pos);
        assigned++;
      }
    }
    const r32 = db.prepare("SELECT * FROM bracket_matches WHERE round = 'r32'").all();
    for (const m of r32) {
      if (m.match_id) {
        db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
          m.home_team || 'Por definir', m.away_team || 'Por definir', m.match_id
        );
      }
    }
    res.json({ ok: true, assigned, total: qualifiers.length, calculated: result.calculated, warnings });
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
