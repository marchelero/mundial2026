/**
 * Seed: Insertar partidos OFICIALES del Mundial 2026
 *
 * Grupos oficiales según sorteo del 5 de diciembre de 2025
 * Horarios en hora de Bolivia (UTC-4)
 *
 * Uso: node scripts/seed_groups.js
 */

const path = require('path');
const fs = require('fs');
const { db, generateId } = require('../backend/db');

const seedData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'seed_data.json'), 'utf8'
));

// =====================================================
// EDITÁ ACÁ LOS CORREOS PERMITIDOS
// =====================================================
const whitelistEmails = [
  'alejandroquea25@gmail.com',
  'alvaro.quena1@gmail.com',
  'andrefer.13.8@gmail.com',
  'andresbr763@gmail.com',
  'ardennmar@gmail.com',
  'azumy24k@gmail.com',
  'brayan.janco@gmail.com',
  'danielpinto9001@gmail.com',
  'ecanaza232@gmail.com',
  'eiquipito160381@gmail.com',
  'franco.harold.yllatarco.castillo@gmail.com',
  'g.gerson51@gmail.com',
  'jmendozam2015@gmail.com',
  'johnnycarmelo17@gmail.com',
  'jonasmaidana47@gmail.com',
  'juanqui.cay@gmail.com',
  'jvargas.eth@gmail.com',
  'liver97mars@gmail.com',
  'lizzysanchez1550@gmail.com',
  'madai.zamudio@gmail.com',
  'marcheloalbis@gmail.com',
  'marcosyana01@gmail.com',
  'maribelpatziv2@gmail.com',
  'maricruzchambi15@gmail.com',
  'miguelvmmh@gmail.com',
  'miltonchirinos45@gmail.com',
  'norsargo@gmail.com',
  'ocallisaya777@gmail.com',
  'oscarmm280599@gmail.com',
  'osmarhinojosa@gmail.com',
  'pabloivanc5@gmail.com',
  'paolitap085@gmail.com',
  'ramirolozacmj@gmail.com',
  'renergueta@gmail.com',
  'rmachaca.anb@gmail.com',
  'rodrigo.salazar.v1@gmail.com',
  'rucocool@gmail.com',
  'scabelhrf@gmail.com',
  'valerytc1407@gmail.com',
  'wr71albarracin@gmail.com',
];

// =====================================================
// 1. INSERTAR GRUPOS
// =====================================================

const insertStmt = db.prepare(`
  INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped = 0;

// Borrar partidos existentes para evitar duplicados
const existing = db.prepare('SELECT COUNT(*) as c FROM matches WHERE round = ?').get('group');
if (existing.c > 0) {
  console.log(`🗑️  Borrando ${existing.c} partidos de fase de grupos existentes...`);
  db.prepare("DELETE FROM matches WHERE round = 'group'").run();
}

const insertMany = db.transaction((groups) => {
  groups.forEach((g) => {
    console.log(`\n📋 Grupo ${g.group}: ${g.teams.join(' vs ')}`);
    g.matches.forEach((m) => {
      const id = generateId();
      insertStmt.run(id, m.date, m.time, m.home_team, m.away_team, null, null, 'open', 'group');
      console.log(`  ✅ ${m.date} ${m.time} | ${m.home_team} vs ${m.away_team}`);
      inserted++;
    });
  });
});

console.log(`\n🔄 Insertando ${seedData.groups.length} grupos...`);
insertMany(seedData.groups);

console.log(`\n✅ Total: ${inserted} partidos de fase de grupos insertados`);

// =====================================================
// WHITELIST
// =====================================================
if (whitelistEmails.length > 0) {
  const existingWL = db.prepare("SELECT id FROM settings WHERE key = 'allowed_emails'").get();
  if (existingWL) {
    console.log('⏭️  Whitelist ya configurada, no se modificó');
  } else {
    const wid = generateId();
    db.prepare("INSERT INTO settings (id, key, value) VALUES (?, 'allowed_emails', ?)").run(wid, JSON.stringify(whitelistEmails));
    console.log(`✅ Whitelist configurada con ${whitelistEmails.length} correo(s)`);
  }
} else {
  console.log('⏭️  Whitelist vacía');
}

// =====================================================
// champion_pick_open default: deshabilitado
// =====================================================
const existingCPO = db.prepare("SELECT id FROM settings WHERE key = 'champion_pick_open'").get();
if (!existingCPO) {
  const cpoId = generateId();
  db.prepare("INSERT INTO settings (id, key, value) VALUES (?, 'champion_pick_open', 'false')").run(cpoId);
  console.log('✅ champion_pick_open inicializado como deshabilitado');
} else {
  console.log('⏭️  champion_pick_open ya configurado');
}

console.log(`\n📊 Grupos oficiales Mundial 2026:`);
seedData.groups.forEach(g => {
  console.log(`  Grupo ${g.group}: ${g.teams.join(', ')}`);
});
console.log(`\nPara ver los partidos:`);
console.log(`  sqlite3 data/mundial2026.db "SELECT date, time, home_team, away_team FROM matches WHERE round='group' ORDER BY date, time;"`);
