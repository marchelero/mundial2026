require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
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
const PORT = process.env.BACKEND_PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: { error: 'Demasiadas solicitudes' } });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos de auth' } });
app.use('/api/auth/', authLimiter);

require('../backend/db');

app.use('/api/auth', require('../backend/routes/auth'));
app.use('/api/matches', require('../backend/routes/matches'));
app.use('/api/predictions', require('../backend/routes/predictions'));
app.use('/api/champion-picks', require('../backend/routes/champion'));
app.use('/api/settings', require('../backend/routes/settings'));
app.use('/api/users', require('../backend/routes/users'));
app.use('/api/groups', require('../backend/routes/groups'));
app.use('/api/push', require('../backend/routes/push'));

const { nowStr, partsInTZ } = require('./utils/datetime');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    utc: new Date().toISOString(),
    bolivia: nowStr(),
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
