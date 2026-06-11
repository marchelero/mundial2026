/**
 * Reset: Vaciar la base de datos
 * Elimina todos los pronósticos, partidos y picks de campeón
 *
 * Uso: node scripts/reset.js
 *
 * La tabla users NO se toca (los usuarios registrados se conservan)
 */

const { db } = require('../backend/db');

console.log('🧹 Limpiando base de datos...\n');

try {
  const preds = db.prepare('SELECT COUNT(*) as c FROM predictions').get().c;
  db.prepare('DELETE FROM predictions').run();
  console.log(`  ✅ ${preds} pronósticos eliminados`);
} catch (e) { console.log('  ⚠️  predictions:', e.message); }

try {
  const picks = db.prepare('SELECT COUNT(*) as c FROM champion_picks').get().c;
  db.prepare('DELETE FROM champion_picks').run();
  console.log(`  ✅ ${picks} picks de campeón eliminados`);
} catch (e) { console.log('  ⚠️  champion_picks:', e.message); }

try {
  const matches = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
  db.prepare('DELETE FROM matches').run();
  console.log(`  ✅ ${matches} partidos eliminados`);
} catch (e) { console.log('  ⚠️  matches:', e.message); }

try {
  const settings = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
  db.prepare('DELETE FROM settings').run();
  console.log(`  ✅ ${settings} settings eliminados`);
} catch (e) { console.log('  ⚠️  settings:', e.message); }

console.log('\n✅ Base de datos vaciada (usuarios conservados)');
console.log('📌 Reiniciá la app para que los cambios tengan efecto');
