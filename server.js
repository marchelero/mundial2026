require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const requiredEnv = ['JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ADMIN_EMAILS'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://flagcdn.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  },
}));
app.use(compression());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: { error: 'Demasiadas solicitudes' } });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos de auth' } });
app.use('/api/auth/', authLimiter);

app.use(express.json({ limit: '1mb' }));

// Backend
require('./backend/db');
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/matches', require('./backend/routes/matches'));
app.use('/api/predictions', require('./backend/routes/predictions'));
app.use('/api/champion-picks', require('./backend/routes/champion'));
app.use('/api/settings', require('./backend/routes/settings'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Frontend
app.use(express.static(path.join(__dirname, 'frontend', 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Mundial 2026 running on port ${PORT}`);
  console.log(`Backend: /api/*  |  Frontend: static files`);
});
