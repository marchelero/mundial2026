const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { nowStr } = require('../utils/datetime');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  try {
    const pick = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
    res.json(pick ? { id: pick.id, champion: pick.champion, points: pick.points ?? null } : { champion: '', points: null });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener pronóstico' });
  }
});

router.get('/all', authRequired, (req, res) => {
  try {
    const picks = db.prepare(`
      SELECT cp.*, u.id as u_id, u.email as u_email, u.name as u_name
      FROM champion_picks cp JOIN users u ON cp.user_id = u.id
    `).all();
    res.json(picks.map(p => ({ id: p.id, user: p.user_id, champion: p.champion, points: p.points ?? null, expand: { user: { id: p.u_id, email: p.u_email, name: p.u_name } } })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener pronósticos' });
  }
});

router.post('/award', authRequired, adminRequired, (req, res) => {
  try {
    // Ensure champion_picks.points column exists (idempotent)
    try { db.exec("ALTER TABLE champion_picks ADD COLUMN points INTEGER DEFAULT NULL"); } catch (_) {}

    const { winner } = req.body;
    if (!winner || typeof winner !== 'string' || winner.trim().length === 0) {
      return res.status(400).json({ error: 'Ganador requerido' });
    }

    const picks = db.prepare('SELECT * FROM champion_picks WHERE champion = ?').all(winner.trim());
    if (picks.length === 0) {
      return res.status(404).json({ error: 'No hay usuarios que hayan elegido a este campeón' });
    }

    const pts = 5;
    const updatePick = db.prepare('UPDATE champion_picks SET points = ? WHERE id = ?');
    const setSetting = db.prepare("INSERT OR REPLACE INTO settings (id, key, value) VALUES (?, 'champion_winner', ?)");

    const runAward = db.transaction(() => {
      // Check INSIDE transaction to prevent race condition
      const existing = db.prepare("SELECT value FROM settings WHERE key = 'champion_winner'").get();
      if (existing && existing.value) {
        throw new Error(`El campeón ya fue asignado: ${existing.value}`);
      }

      for (const pick of picks) {
        updatePick.run(pts, pick.id);
        // Recalculate total_points from scratch: predictions + champion
        const predSum = db.prepare("SELECT COALESCE(SUM(points), 0) as s FROM predictions WHERE user_id = ? AND points IS NOT NULL").get(pick.user_id);
        const total = predSum.s + pts;
        db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(total, pick.user_id);
      }
      setSetting.run(generateId(), winner.trim());
    });

    runAward();
    res.json({ winner: winner.trim(), points: pts, awarded: picks.length });
  } catch (e) {
    console.error('Error awarding champion points:', e.message);
    res.status(500).json({ error: 'Error al otorgar puntos de campeón' });
  }
});

router.post('/', authRequired, (req, res) => {
  try {
    const { champion } = req.body;
    if (!champion || typeof champion !== 'string' || champion.trim().length === 0) {
      return res.status(400).json({ error: 'Campeón requerido' });
    }

    // Validar si el pronóstico está habilitado
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'champion_pick_open'").get();
    const isOpen = setting ? String(setting.value) === 'true' : false;
    if (!isOpen) {
      return res.status(403).json({ error: 'El pronóstico del campeón está deshabilitado por el administrador' });
    }

    // Validar fecha límite (Dom 28 jun 2026 15:00 hora Bolivia / America/La_Paz)
    const now = nowStr();
    const deadline = '2026-06-28 15:00';
    if (now >= deadline) {
      return res.status(400).json({ error: 'La fecha límite para el pronóstico del campeón ya pasó' });
    }

    const existing = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE champion_picks SET champion = ? WHERE user_id = ?').run(champion.trim(), req.user.id);
      const updated = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
      return res.json({ id: updated.id, champion: updated.champion, points: updated.points ?? null });
    }
    const id = generateId();
    db.prepare('INSERT INTO champion_picks (id, user_id, champion) VALUES (?, ?, ?)').run(id, req.user.id, champion.trim());
    res.status(201).json({ id, champion: champion.trim(), points: null });
  } catch (e) {
    console.error('Error saving champion pick:', e.message);
    res.status(500).json({ error: 'Error al guardar pronóstico' });
  }
});

module.exports = router;
