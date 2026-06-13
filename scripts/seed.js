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

// 4. RESULTADOS REALES (partidos ya jugados)
console.log('\n🏆 Resultados reales:');
const RESULTS = {
  'México vs Sudáfrica':              { home: 2, away: 0 },
  'Corea del Sur vs República Checa': { home: 2, away: 1 },
  'Canadá vs Bosnia y Herzegovina':   { home: 1, away: 1 },
  'Estados Unidos vs Paraguay':       { home: 4, away: 1 },
};

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
const NAME_TO_EMAIL = {
  'Alejandro Quea': 'alejandroquea25@gmail.com',
  'Andreina Fernandez': 'andrefer.13.8@gmail.com',
  'Andres Blanco': 'andresbr763@gmail.com',
  'Bety Condori': 'azumy24k@gmail.com',
  'Brayan Janco': 'brayan.janco@gmail.com',
  'Brian Salazar': 'rodrigo.salazar.v1@gmail.com',
  'Daniel Pinto': 'danielpinto9001@gmail.com',
  'Dennys Flores': 'ardennmar@gmail.com',
  'Esteban Canaza': 'ecanaza232@gmail.com',
  'Franco Yllatarco': 'franco.harold.yllatarco.castillo@gmail.com',
  'Gerson Andrade': 'g.gerson51@gmail.com',
  'Horacio Ramos': 'scabelhrf@gmail.com',
  'Johnny Yujra': 'johnnycarmelo17@gmail.com',
  'Jonas Maidana': 'jonasmaidana47@gmail.com',
  'Jose Vargas': 'jvargas.eth@gmail.com',
  'Juan Carlos Mamani': 'juanqui.cay@gmail.com',
  'Karen Sanchez': 'lizzysanchez1550@gmail.com',
  'Madai Zamudio': 'madai.zamudio@gmail.com',
  'Marcelo Albis': 'marcheloalbis@gmail.com',
  'Marco Yana': 'marcosyana01@gmail.com',
  'Maribel Patzi': 'maribelpatziv2@gmail.com',
  'MariCruz Chambi': 'maricruzchambi15@gmail.com',
  'Milton Chirinos': 'miltonchirinos45@gmail.com',
  'Norma Saravia': 'norsargo@gmail.com',
  'Oliver': 'liver97mars@gmail.com',
  'Oscar Marin': 'oscarmm280599@gmail.com',
  'Pablo Cruz': 'pabloivanc5@gmail.com',
  'Ramiro Loza': 'ramirolozacmj@gmail.com',
  'Rene Ergueta': 'renergueta@gmail.com',
  'Roberto Albarracin': 'wr71albarracin@gmail.com',
  'Roxana Layme': 'paolitap085@gmail.com',
  'Ruben Machaca': 'rmachaca.anb@gmail.com',
  'Ruddy Condori': 'rucocool@gmail.com',
  'Valeria': 'valerytc1407@gmail.com',
  'Erik Rubens': 'eiquipito160381@gmail.com',
  'Alvaro Quena': 'alvaro.quena1@gmail.com',
  'Miguel Mollo': 'miguelvmmh@gmail.com',
  'Jenny Mendoza': 'jmendozam2015@gmail.com',
  'Orlando Callisaya': 'ocallisaya777@gmail.com',
  'Osmar Hinojosa': 'osmarhinojosa@gmail.com',
};
const P_MATCHES = [
  { home: 'México', away: 'Sudáfrica' },
  { home: 'Corea del Sur', away: 'República Checa' },
  { home: 'Canadá', away: 'Bosnia y Herzegovina' },
  { home: 'Estados Unidos', away: 'Paraguay' },
];
const PREDICTIONS = {
  'Andres Blanco':[[2,0],[2,1],[2,1],[1,0]],'Franco Yllatarco':[[2,0],[2,1],[2,1],[2,0]],
  'Milton Chirinos':[[2,0],[2,1],[2,1],[2,1]],'Ruben Machaca':[[2,0],[2,1],[2,1],[1,1]],
  'Orlando Callisaya':[[2,1],[1,0],[1,1],[0,2]],'Jenny Mendoza':[[2,0],[3,1],[1,2],[2,0]],
  'Bety Condori':[[2,1],[2,1],[1,0],[2,1]],'Marco Yana':[[2,1],[2,1],null,null],
  'Juan Carlos Mamani':[[1,1],[2,0],[1,1],[1,2]],'Roxana Layme':[null,[2,0],[1,1],[1,1]],
  'Alvaro Quena':[[2,0],[1,1],[1,0],[1,0]],'Esteban Canaza':[[2,0],[1,1],[2,0],[1,0]],
  'Miguel Mollo':[[2,0],[0,1],[2,0],[2,1]],'Oliver':[[2,0],[1,1],null,[2,1]],
  'Osmar Hinojosa':[null,[2,1],[3,1],[2,0]],'Ramiro Loza':[[2,0],[1,1],[2,1],[2,1]],
  'Gerson Andrade':[[2,0],[1,1],null,[2,1]],'Dennys Flores':[[1,1],[2,1],[2,0],[1,1]],
  'Horacio Ramos':[[1,1],[2,1],[2,1],[1,1]],'Jose Vargas':[[2,0],[1,1],[2,1],[1,2]],
  'Andreina Fernandez':[[2,1],[1,0],[2,1],[2,1]],'Madai Zamudio':[[2,1],[1,0],[2,1],[2,0]],
  'Marcelo Albis':[[2,1],[1,0],[1,0],[1,0]],'Ruddy Condori':[[2,1],[1,0],[2,1],[1,0]],
  'Alejandro Quea':[[2,1],[1,0],[2,1],[1,1]],'Daniel Pinto':[[1,0],[1,0],[1,0],[1,1]],
  'MariCruz Chambi':[[2,1],[2,0],null,[0,1]],'Valeria':[[2,1],[2,0],null,null],
  'Rene Ergueta':[[2,1],[1,1],[2,2],[1,1]],'Brayan Janco':[[1,0],[1,1],[2,1],[2,0]],
  'Erik Rubens':[[3,1],[1,1],[1,0],[2,1]],'Johnny Yujra':[[1,0],[0,0],[2,1],[2,1]],
  'Karen Sanchez':[[2,1],[1,1],[2,0],[2,1]],'Maribel Patzi':[[2,1],[1,1],[2,1],[1,0]],
  'Roberto Albarracin':[[2,1],[1,1],[2,1],[2,1]],'Norma Saravia':[[1,0],[1,1],[2,1],[1,1]],
  'Brian Salazar':[[1,1],[1,1],[1,0],[1,0]],'Jonas Maidana':[[0,1],[1,1],[2,0],[1,0]],
  'Oscar Marin':[null,null,[2,1],[2,1]],'Pablo Cruz':[[1,1],[0,1],[2,1],[1,1]],
};

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
