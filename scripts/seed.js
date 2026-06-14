const path = require('path');
const fs = require('fs');
const { db, generateId } = require('../backend/db');
const { NAME_TO_EMAIL, P_MATCHES, PREDICTIONS, RESULTS } = require('./predictions-data');

const dataDir = path.join(__dirname, '..', 'data');
const matchesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf8'));
const emails = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));

const EMAIL_TO_NAME = Object.fromEntries(
  Object.entries(NAME_TO_EMAIL).map(([name, email]) => [email, name])
);

console.log('\n🌱 Sembrando base de datos...\n');

// 1. MATCHES
console.log('📋 Partidos:');
const insertMatch = db.prepare(`
  INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const existingMatches = db.prepare("SELECT COUNT(*) as c FROM matches WHERE round = 'group'").get().c;
if (existingMatches > 0) {
  db.prepare("DELETE FROM matches WHERE round = 'group'").run();
  console.log(`  🗑️  ${existingMatches} partidos previos eliminados`);
}

let count = 0;
for (const group of matchesData.groups) {
  for (const m of group.matches) {
    insertMatch.run(generateId(), m.date, m.time, m.home_team, m.away_team, null, null, 'open', 'group');
    count++;
  }
}
console.log(`  ✅ ${count} partidos de fase de grupos insertados`);

// 2. USERS
console.log('\n👥 Usuarios:');
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, NULL, ?, ?)');
  const insertMany = db.transaction((list) => {
    for (const email of list) {
      insertUser.run(generateId(), email, EMAIL_TO_NAME[email] || null);
    }
  });
  insertMany(emails);
  console.log(`  ✅ ${emails.length} usuarios creados (google_id pendiente de vincular)`);
} else {
  console.log(`  ⏭️  Ya existen ${userCount} usuario(s), no se modificó`);
}

// 3. SETTINGS
console.log('\n⚙️  Settings:');
const existingCPO = db.prepare("SELECT id FROM settings WHERE key = 'champion_pick_open'").get();
if (!existingCPO) {
  db.prepare("INSERT INTO settings (id, key, value) VALUES (?, 'champion_pick_open', 'false')").run(generateId());
  console.log('  ✅ champion_pick_open = false (por defecto)');
} else {
  console.log('  ⏭️  champion_pick_open ya configurado');
}

// 4. RESULTADOS REALES (partidos ya jugados)
console.log('\n🏆 Resultados reales:');

const updateResult = db.prepare(`
  UPDATE matches SET home_score = ?, away_score = ?, status = 'finished'
  WHERE home_team = ? AND away_team = ?
`);

let resCount = 0;
for (const group of matchesData.groups) {
  for (const m of group.matches) {
    const key = `${m.home_team} vs ${m.away_team}`;
    if (RESULTS[key]) {
      const { home, away } = RESULTS[key];
      updateResult.run(home, away, m.home_team, m.away_team);
      console.log(`  ✅ ${key}: ${home}-${away}`);
      resCount++;
    }
  }
}
console.log(`  ${resCount} partidos marcados como finished`);

// 5. PREDICCIONES DE PLANILLA (partidos ya jugados)
console.log('\n📝 Predicciones de planilla:');

const getUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
const getMatchByTeams = db.prepare('SELECT id FROM matches WHERE home_team = ? AND away_team = ?');
const upsertPred = db.prepare(`INSERT INTO predictions (id, user_id, match_id, home_score, away_score, comodin) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(user_id, match_id) DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score`);

let predTotal = 0, predSkip = 0;
for (const [name, preds] of Object.entries(PREDICTIONS)) {
  const user = getUserByEmail.get(NAME_TO_EMAIL[name]);
  if (!user) { console.log(`  ⚠️  ${name}: usuario no encontrado`); continue; }
  for (let i = 0; i < P_MATCHES.length; i++) {
    if (!preds[i]) { predSkip++; continue; }
    const match = getMatchByTeams.get(P_MATCHES[i].home, P_MATCHES[i].away);
    if (!match) continue;
    upsertPred.run(generateId(), user.id, match.id, preds[i][0], preds[i][1]);
    predTotal++;
  }
}
console.log(`  ✅ ${predTotal} predicciones insertadas (${predSkip} vacías omitidas)`);
console.log('\n✅ Seed completado');
