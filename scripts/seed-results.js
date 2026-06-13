const path = require('path');
const fs = require('fs');
const { db } = require('../backend/db');

const dataDir = path.join(__dirname, '..', 'data');
const matchesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf8'));

const RESULTS = {
  // --- GRUPO A (11 Jun) ---
  'México vs Sudáfrica':              { home: 2, away: 0 },
  'Corea del Sur vs República Checa': { home: 2, away: 1 },

  // --- GRUPO B (12 Jun) ---
  'Canadá vs Bosnia y Herzegovina':   { home: 1, away: 1 },

  // --- GRUPO D (12 Jun) ---
  'Estados Unidos vs Paraguay':       { home: 4, away: 1 },
};

function matchKey(home, away) {
  return `${home} vs ${away}`;
}

console.log('\n🏆 Sembrando resultados de partidos jugados...\n');

const updateMatch = db.prepare(`
  UPDATE matches SET home_score = ?, away_score = ?, status = 'finished'
  WHERE home_team = ? AND away_team = ? AND status != 'deleted'
`);

const checkMatch = db.prepare(`
  SELECT id, home_team, away_team, status FROM matches
  WHERE home_team = ? AND away_team = ?
`);

let updated = 0;
let notFound = 0;

for (const group of matchesData.groups) {
  for (const m of group.matches) {
    const key = matchKey(m.home_team, m.away_team);
    if (RESULTS[key]) {
      const existing = checkMatch.get(m.home_team, m.away_team);
      if (existing) {
        const { home, away } = RESULTS[key];
        updateMatch.run(home, away, m.home_team, m.away_team);
        const arrow = existing.status === 'finished' ? '↻' : '→';
        console.log(`  ✅ ${key}: ${home}-${away} (${arrow} finished)`);
        updated++;
      } else {
        console.log(`  ❌ ${key}: partido no encontrado en BD`);
        notFound++;
      }
    }
  }
}

console.log(`\n📊 ${updated} partidos actualizados con resultados reales`);
if (notFound > 0) console.log(`⚠️  ${notFound} partidos no encontrados (ejecuta primero npm run seed)`);
console.log('✅ Seed de resultados completado');
