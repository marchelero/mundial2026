const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { db, restoreFrom } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, adminRequired, async (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'mundial2026.db');
  const backupPath = dbPath + '.backup';
  console.log('[BACKUP-FIX-2026-06-15] GET /api/backup called');

  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    await db.backup(backupPath);

    res.download(backupPath, 'mundial2026-backup.db', (err) => {
      if (err) console.error('Error sending backup:', err);
      try { fs.unlinkSync(backupPath); } catch (e) {}
    });
  } catch (e) {
    console.error('Error creating backup:', e);
    try { fs.unlinkSync(backupPath); } catch (e) {}
    res.status(500).json({ error: 'Error al generar backup' });
  }
});

router.post('/restore', authRequired, adminRequired, async (req, res) => {
  console.log('[BACKUP-FIX-2026-06-15] POST /api/backup/restore called');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const tempPath = path.join(dataDir, 'mundial2026-restore.tmp');
  const cleanupTemp = () => {
    try { fs.unlinkSync(tempPath); } catch (e) {}
    try { fs.unlinkSync(tempPath + '-wal'); } catch (e) {}
    try { fs.unlinkSync(tempPath + '-shm'); } catch (e) {}
  };

  try {
    const { data } = req.body;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Archivo inválido o vacío' });
    }
    const buf = Buffer.from(data, 'base64');
    if (buf.length < 16) {
      return res.status(400).json({ error: 'Archivo inválido o vacío' });
    }

    const expectedHeader = Buffer.from('SQLite format 3\0', 'binary');
    if (buf.slice(0, 16).compare(expectedHeader) !== 0) {
      return res.status(400).json({ error: 'El archivo no es una base de datos SQLite válida' });
    }

    fs.writeFileSync(tempPath, buf);

    let testDb;
    try {
      testDb = new Database(tempPath, { readonly: true });
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
      const required = ['users', 'matches', 'predictions'];
      for (const t of required) {
        if (!tables.includes(t)) {
          if (testDb) testDb.close();
          cleanupTemp();
          return res.status(400).json({ error: 'El archivo no es una base de datos válida del mundial' });
        }
      }
    } catch (e) {
      console.error('Backup validation failed:', e);
      if (testDb) testDb.close();
      cleanupTemp();
      return res.status(400).json({ error: 'El archivo no es una base de datos SQLite válida: ' + e.message });
    } finally {
      if (testDb) testDb.close();
    }

    restoreFrom(tempPath);
    cleanupTemp();

    res.json({ success: true, message: 'Base de datos restaurada correctamente' });
  } catch (e) {
    console.error('Error restoring backup:', e);
    cleanupTemp();
    res.status(500).json({ error: 'Error al restaurar backup: ' + e.message });
  }
});

module.exports = router;
