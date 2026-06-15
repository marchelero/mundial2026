require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.FRONTEND_PORT || process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 3001}`;

app.use(express.json({ limit: '10mb' }));

app.use('/api', (req, res) => {
  const target = new URL(BACKEND_URL + req.originalUrl);
  const isGet = req.method === 'GET' || req.method === 'HEAD';
  const isBinary = req.originalUrl.startsWith('/api/backup') && isGet;
  const body = isGet ? null : JSON.stringify(req.body || {});

  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: {
      'Authorization': req.headers.authorization || '',
    },
  };

  if (!isGet) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(body || '');
  }

  const proxyReq = http.request(options, (proxyRes) => {
    if (isBinary) {
      res.status(proxyRes.statusCode);
      if (proxyRes.headers['content-type']) res.set('Content-Type', proxyRes.headers['content-type']);
      if (proxyRes.headers['content-disposition']) res.set('Content-Disposition', proxyRes.headers['content-disposition']);
      if (proxyRes.headers['content-length']) res.set('Content-Length', proxyRes.headers['content-length']);
      proxyRes.pipe(res);
    } else {
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const data = Buffer.concat(chunks);
        try {
          res.status(proxyRes.statusCode).json(JSON.parse(data.toString('utf8')));
        } catch {
          res.status(proxyRes.statusCode).send(data);
        }
      });
    }
  });

  proxyReq.on('error', () => {
    res.status(502).json({ error: 'Backend no disponible' });
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
});

app.get('/config.js', (req, res) => {
  const pkg = require('../package.json');
  res.type('application/javascript');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(
    `var APP_VERSION = ${JSON.stringify(pkg.version)};\n` +
    `var ADMIN_EMAILS = ${JSON.stringify((process.env.ADMIN_EMAILS || 'marcheloalbis@gmail.com').split(',').map(e => e.trim()).filter(Boolean))};\n` +
    `var GOOGLE_CLIENT_ID = ${JSON.stringify(process.env.GOOGLE_CLIENT_ID || '712856774028-gorqjq370pn9okuec2ar99ultjod21n7.apps.googleusercontent.com')};\n` +
    `var VAPID_PUBLIC_KEY = ${JSON.stringify(process.env.VAPID_PUBLIC_KEY || '')};\n`
  );
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API proxy: ${BACKEND_URL}/api/`);
});
