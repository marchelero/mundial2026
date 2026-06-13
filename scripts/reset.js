const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'mundial2026.db');

console.log('🧹 Limpiando base de datos...');

// Opción 1: borrar archivo (solo si ningún otro proceso lo usa)
let fileDeleted = false;
for (const suffix of ['', '-wal', '-shm']) {
  try {
    fs.unlinkSync(dbPath + suffix);
    fileDeleted = true;
  } catch (_) {}
}

if (fileDeleted) {
  console.log('  Archivo eliminado, recreando...');
  require('../backend/db');
} else {
  // Opción 2: vaciar tablas (BD en uso por otro proceso)
  console.log('  BD en uso por otro proceso, vaciando tablas...');
  const { db } = require('../backend/db');
  const tables = ['predictions', 'champion_picks', 'push_subscriptions', 'matches', 'settings', 'users'];
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of tables) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.exec('PRAGMA foreign_keys = ON');
}

console.log('✅ Base de datos reiniciada');
