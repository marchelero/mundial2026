const path = require('path');
const fs = require('fs');
const { db, generateId } = require('../backend/db');

const dataDir = path.join(__dirname, '..', 'data');
const matchesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf8'));
const emails = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));

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
  const insertUser = db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, NULL, ?, NULL)');
  const insertMany = db.transaction((list) => {
    for (const email of list) {
      insertUser.run(generateId(), email);
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

console.log('\n✅ Seed completado');
