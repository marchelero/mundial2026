const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM settings').all());
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

router.post('/', authRequired, adminRequired, (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return res.status(400).json({ error: 'Key requerida' });
    }
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim());
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value ?? '', key.trim());
      return res.json(db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim()));
    }
    const id = generateId();
    db.prepare('INSERT INTO settings (id, key, value) VALUES (?, ?, ?)').run(id, key.trim(), value ?? '');
    res.status(201).json(db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim()));
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

module.exports = router;
