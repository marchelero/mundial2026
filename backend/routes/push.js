const express = require('express');
const { db, generateId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/subscribe', authRequired, (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Faltan datos de suscripción' });
    }

    const existing = db.prepare(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).get(req.user.id, endpoint);

    if (existing) {
      db.prepare('UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?')
        .run(keys.p256dh, keys.auth, existing.id);
      return res.json({ subscribed: true });
    }

    const id = generateId();
    db.prepare(
      'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.user.id, endpoint, keys.p256dh, keys.auth);

    res.status(201).json({ subscribed: true });
  } catch (e) {
    console.error('[Push] Subscribe error:', e.message);
    res.status(500).json({ error: 'Error al suscribir' });
  }
});

router.delete('/subscribe', authRequired, (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Falta endpoint' });
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .run(req.user.id, endpoint);
    res.json({ unsubscribed: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al desuscribir' });
  }
});

router.get('/vapid-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

module.exports = router;
