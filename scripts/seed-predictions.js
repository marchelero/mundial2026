const path = require('path');
const { db, generateId } = require('../backend/db');

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

const MATCHES = [
  { key: 'México vs Sudáfrica', home: 'México', away: 'Sudáfrica' },
  { key: 'Corea del Sur vs República Checa', home: 'Corea del Sur', away: 'República Checa' },
  { key: 'Canadá vs Bosnia y Herzegovina', home: 'Canadá', away: 'Bosnia y Herzegovina' },
  { key: 'Estados Unidos vs Paraguay', home: 'Estados Unidos', away: 'Paraguay' },
];

const PREDICTIONS = {
  'Andres Blanco':        [[2, 0], [2, 1], [2, 1], [1, 0]],
  'Franco Yllatarco':     [[2, 0], [2, 1], [2, 1], [2, 0]],
  'Milton Chirinos':      [[2, 0], [2, 1], [2, 1], [2, 1]],
  'Ruben Machaca':        [[2, 0], [2, 1], [2, 1], [1, 1]],
  'Orlando Callisaya':    [[2, 1], [1, 0], [1, 1], [0, 2]],
  'Jenny Mendoza':        [[2, 0], [3, 1], [1, 2], [2, 0]],
  'Bety Condori':         [[2, 1], [2, 1], [1, 0], [2, 1]],
  'Marco Yana':           [[2, 1], [2, 1], null, null],
  'Juan Carlos Mamani':   [[1, 1], [2, 0], [1, 1], [1, 2]],
  'Roxana Layme':         [null, [2, 0], [1, 1], [1, 1]],
  'Alvaro Quena':         [[2, 0], [1, 1], [1, 0], [1, 0]],
  'Esteban Canaza':       [[2, 0], [1, 1], [2, 0], [1, 0]],
  'Miguel Mollo':         [[2, 0], [0, 1], [2, 0], [2, 1]],
  'Oliver':               [[2, 0], [1, 1], null, [2, 1]],
  'Osmar Hinojosa':       [null, [2, 1], [3, 1], [2, 0]],
  'Ramiro Loza':          [[2, 0], [1, 1], [2, 1], [2, 1]],
  'Gerson Andrade':       [[2, 0], [1, 1], null, [2, 1]],
  'Dennys Flores':        [[1, 1], [2, 1], [2, 0], [1, 1]],
  'Horacio Ramos':        [[1, 1], [2, 1], [2, 1], [1, 1]],
  'Jose Vargas':          [[2, 0], [1, 1], [2, 1], [1, 2]],
  'Andreina Fernandez':   [[2, 1], [1, 0], [2, 1], [2, 1]],
  'Madai Zamudio':        [[2, 1], [1, 0], [2, 1], [2, 0]],
  'Marcelo Albis':        [[2, 1], [1, 0], [1, 0], [1, 0]],
  'Ruddy Condori':        [[2, 1], [1, 0], [2, 1], [1, 0]],
  'Alejandro Quea':       [[2, 1], [1, 0], [2, 1], [1, 1]],
  'Daniel Pinto':         [[1, 0], [1, 0], [1, 0], [1, 1]],
  'MariCruz Chambi':      [[2, 1], [2, 0], null, [0, 1]],
  'Valeria':              [[2, 1], [2, 0], null, null],
  'Rene Ergueta':         [[2, 1], [1, 1], [2, 2], [1, 1]],
  'Brayan Janco':         [[1, 0], [1, 1], [2, 1], [2, 0]],
  'Erik Rubens':          [[3, 1], [1, 1], [1, 0], [2, 1]],
  'Johnny Yujra':         [[1, 0], [0, 0], [2, 1], [2, 1]],
  'Karen Sanchez':        [[2, 1], [1, 1], [2, 0], [2, 1]],
  'Maribel Patzi':        [[2, 1], [1, 1], [2, 1], [1, 0]],
  'Roberto Albarracin':   [[2, 1], [1, 1], [2, 1], [2, 1]],
  'Norma Saravia':        [[1, 0], [1, 1], [2, 1], [1, 1]],
  'Brian Salazar':        [[1, 1], [1, 1], [1, 0], [1, 0]],
  'Jonas Maidana':        [[0, 1], [1, 1], [2, 0], [1, 0]],
  'Oscar Marin':          [null, null, [2, 1], [2, 1]],
  'Pablo Cruz':           [[1, 1], [0, 1], [2, 1], [1, 1]],
};

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

  for (let i = 0; i < MATCHES.length; i++) {
    const pred = predictions[i];
    if (!pred) { skipped++; continue; }

    const [home, away] = pred;
    const match = getMatch.get(MATCHES[i].home, MATCHES[i].away);
    if (!match) { errors.push(`${name}: partido ${MATCHES[i].key} no encontrado`); continue; }

    upsertPrediction.run(generateId(), user.id, match.id, home, away);
    total++;
  }
}

console.log(`  ✅ ${total} predicciones insertadas/actualizadas`);
if (skipped > 0) console.log(`  ⏭️  ${skipped} predicciones vacías omitidas`);
if (errors.length > 0) console.log(`  ⚠️  ${errors.length} errores:\n    ${errors.join('\n    ')}`);
console.log('\n✅ Seed de predicciones completado');
