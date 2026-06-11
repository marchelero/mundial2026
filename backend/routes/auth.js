const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { db, generateId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Credential requerido' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email no disponible en el token' });
    }

    const allowedSetting = db.prepare("SELECT value FROM settings WHERE key = 'allowed_emails'").get();
    let allowedList = [];
    if (allowedSetting && allowedSetting.value && allowedSetting.value.trim()) {
      const raw = allowedSetting.value.trim();
      try { allowedList = JSON.parse(raw); } catch (_) { allowedList = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean); }
    }
    if (allowedList.length === 0) {
      return res.status(403).json({ error: 'Acceso restringido. No hay emails permitidos configurados. Contacta al administrador.' });
    }
    if (!allowedList.includes(email.toLowerCase())) {
      return res.status(403).json({ error: 'Acceso no autorizado. Tu correo no está en la lista de permitidos. Contacta al administrador.' });
    }

    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      } else {
        const id = generateId();
        const userName = name || email.split('@')[0];
        db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, ?, ?, ?)').run(id, googleId, email, userName);
        user = { id, google_id: googleId, email, name: userName };
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e) {
    console.error('Auth error:', e.message);
    res.status(401).json({ error: 'Token de Google inválido o expirado' });
  }
});

router.get('/me', authRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.post('/refresh', authRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: 'Error al refrescar token' });
  }
});

module.exports = router;
