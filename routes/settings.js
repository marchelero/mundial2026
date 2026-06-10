const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
  } catch (e) {
    console.error('Error fetching settings:', e.message);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

router.post('/', authRequired, adminRequired, (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return res.status(400).json({ error: 'Key requerida' });
    }

    if (key.length > 100) {
      return res.status(400).json({ error: 'Key demasiado larga (máx 100 caracteres)' });
    }

    if (value !== undefined && value !== null && typeof value === 'string' && value.length > 500) {
      return res.status(400).json({ error: 'Value demasiado largo (máx 500 caracteres)' });
    }

    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim());
    
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value ?? '', key.trim());
      const updated = db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim());
      return res.json(updated);
    }

    const id = generateId();
    db.prepare('INSERT INTO settings (id, key, value) VALUES (?, ?, ?)').run(id, key.trim(), value ?? '');
    const created = db.prepare('SELECT * FROM settings WHERE key = ?').get(key.trim());
    res.status(201).json(created);
  } catch (e) {
    console.error('Error saving setting:', e.message);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

module.exports = router;
