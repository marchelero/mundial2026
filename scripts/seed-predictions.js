const { db, generateId } = require('../backend/db');
const { NAME_TO_EMAIL, P_MATCHES, PREDICTIONS } = require('./predictions-data');

console.log('\n📝 Sembrando predicciones de la planilla...\n');

const getUser = db.prepare('SELECT id, email FROM users WHERE email = ?');
const getMatch = db.prepare('SELECT id FROM matches WHERE home_team = ? AND away_team = ?');
const upsertPrediction = db.prepare(`
  INSERT INTO predictions (id, user_id, match_id, home_score, away_score, comodin)
  VALUES (?, ?, ?, ?, ?, 0)
  ON CONFLICT(user_id, match_id) DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score
`);

let total = 0;
let skipped = 0;
let errors = [];

for (const [name, predictions] of Object.entries(PREDICTIONS)) {
  const email = NAME_TO_EMAIL[name];
  if (!email) { errors.push(`${name}: sin email`); continue; }

  const user = getUser.get(email);
  if (!user) { errors.push(`${name}: usuario no encontrado (${email})`); continue; }

  for (let i = 0; i < P_MATCHES.length; i++) {
    const pred = predictions[i];
    if (!pred) { skipped++; continue; }

    const [home, away] = pred;
    const match = getMatch.get(P_MATCHES[i].home, P_MATCHES[i].away);
    if (!match) { errors.push(`${name}: partido ${P_MATCHES[i].home} vs ${P_MATCHES[i].away} no encontrado`); continue; }

    upsertPrediction.run(generateId(), user.id, match.id, home, away);
    total++;
  }
}

console.log(`  ✅ ${total} predicciones insertadas/actualizadas`);
if (skipped > 0) console.log(`  ⏭️  ${skipped} predicciones vacías omitidas`);
if (errors.length > 0) console.log(`  ⚠️  ${errors.length} errores:\n    ${errors.join('\n    ')}`);
console.log('\n✅ Seed de predicciones completado');
