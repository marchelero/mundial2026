const express = require('express');
const { db, generateId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  try {
    const pick = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
    res.json(pick ? { id: pick.id, champion: pick.champion } : { champion: '' });
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
    res.json(picks.map(p => ({ id: p.id, user: p.user_id, champion: p.champion, expand: { user: { id: p.u_id, email: p.u_email, name: p.u_name } } })));
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener pronósticos' });
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

    // Validar fecha límite (Dom 28 jun 2026 15:00 Bolivia)
    const now = new Date();
    const deadline = new Date('2026-06-28T15:00:00');
    if (now >= deadline) {
      return res.status(400).json({ error: 'La fecha límite para el pronóstico del campeón ya pasó' });
    }

    const existing = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE champion_picks SET champion = ? WHERE user_id = ?').run(champion.trim(), req.user.id);
      const updated = db.prepare('SELECT * FROM champion_picks WHERE user_id = ?').get(req.user.id);
      return res.json({ id: updated.id, champion: updated.champion });
    }
    const id = generateId();
    db.prepare('INSERT INTO champion_picks (id, user_id, champion) VALUES (?, ?, ?)').run(id, req.user.id, champion.trim());
    res.status(201).json({ id, champion: champion.trim() });
  } catch (e) {
    console.error('Error saving champion pick:', e.message);
    res.status(500).json({ error: 'Error al guardar pronóstico' });
  }
});

module.exports = router;
