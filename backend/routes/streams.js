const express = require('express');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

let currentStreams = [];

router.get('/', (req, res) => {
  res.json(currentStreams);
});

router.post('/', authRequired, adminRequired, (req, res) => {
  const sources = req.body.sources;
  if (!Array.isArray(sources)) {
    return res.status(400).json({ error: 'Se requiere un array de fuentes' });
  }
  currentStreams = sources
    .map(s => ({ label: String(s.label || '').trim(), url: String(s.url || '').trim() }))
    .filter(s => s.url);
  res.json({ ok: true, streams: currentStreams });
});

module.exports = router;
