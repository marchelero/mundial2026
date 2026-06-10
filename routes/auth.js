const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { db, generateId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

console.log('Auth route initialized with GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...');

router.post('/google', async (req, res) => {
  console.log('POST /api/auth/google received');
  try {
    const { credential } = req.body;
    console.log('Credential received:', credential ? 'yes' : 'no');
    
    if (!credential) {
      console.log('No credential provided');
      return res.status(400).json({ error: 'Credential requerido' });
    }

    console.log('Verifying Google token...');
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;
    console.log('Token verified for:', email);

    if (!email) {
      console.log('No email in token');
      return res.status(400).json({ error: 'Email no disponible en el token de Google' });
    }

    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    console.log('User lookup by google_id:', user ? 'found' : 'not found');
    
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      console.log('User lookup by email:', user ? 'found' : 'not found');
      
      if (user) {
        console.log('Updating existing user with google_id');
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      } else {
        console.log('Creating new user');
        const id = generateId();
        const userName = name || email.split('@')[0];
        db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, ?, ?, ?)').run(id, googleId, email, userName);
        user = { id, google_id: googleId, email, name: userName };
      }
    }

    console.log('Generating JWT for user:', user.id);
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful, returning token');
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e) {
    console.error('Auth error:', e.message);
    console.error('Error details:', e);
    res.status(401).json({ error: 'Token de Google inválido o expirado' });
  }
});

router.get('/me', authRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user });
  } catch (e) {
    console.error('Error getting user:', e.message);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.post('/refresh', authRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (e) {
    console.error('Error refreshing token:', e.message);
    res.status(500).json({ error: 'Error al refrescar token' });
  }
});

module.exports = router;
