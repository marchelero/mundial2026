/**
 * Seed: Insertar partidos de la fase de grupos
 * Mundial 2026
 *
 * Antes de ejecutar, EDITÁ los grupos y las fechas/horas
 * abajo en la sección "PARTIDOS".
 *
 * Uso: node scripts/seed_groups.js
 */

const path = require('path');
const { db, generateId } = require('../backend/db');

// =====================================================
// 0. EDITÁ ACÁ LOS CORREOS PERMITIDOS
// =====================================================
// Dejá el array vacío = todos pueden ingresar (sin whitelist)
// =====================================================
const whitelistEmails = [
  // 'admin@email.com',
  // 'amigo1@gmail.com',
];

// =====================================================
// 1. EDITÁ ACÁ TUS PARTIDOS
// =====================================================
// Formato: { date, time (HH:MM Bolivia UTC-4), home_team, away_team }
// Dejá vacío el array y agregá los partidos manualmente,
// o completá con los datos reales cuando se sorteen los grupos.
//
// EJEMPLO (borrar y reemplazar):
// =====================================================

const matches = [
  // Formato: { date: '2026-06-11', time: '13:00', home_team: 'México', away_team: 'Canadá' },

  // --- Grupo A ---
  { date: '2026-06-11', time: '13:00', home_team: 'México', away_team: 'Canadá' },
  { date: '2026-06-15', time: '15:30', home_team: 'México', away_team: 'Estados Unidos' },
  { date: '2026-06-19', time: '18:00', home_team: 'Canadá', away_team: 'Estados Unidos' },

  // --- Grupo B ---
  { date: '2026-06-12', time: '13:00', home_team: 'Argentina', away_team: 'Brasil' },
  { date: '2026-06-16', time: '15:30', home_team: 'Argentina', away_team: 'Uruguay' },
  { date: '2026-06-20', time: '18:00', home_team: 'Brasil', away_team: 'Uruguay' },

  // --- Grupo C ---
  { date: '2026-06-12', time: '18:00', home_team: 'España', away_team: 'Francia' },
  { date: '2026-06-16', time: '20:30', home_team: 'España', away_team: 'Alemania' },
  { date: '2026-06-20', time: '15:30', home_team: 'Francia', away_team: 'Alemania' },

  // --- Grupo D ---
  { date: '2026-06-13', time: '13:00', home_team: 'Inglaterra', away_team: 'Italia' },
  { date: '2026-06-17', time: '15:30', home_team: 'Inglaterra', away_team: 'Países Bajos' },
  { date: '2026-06-21', time: '18:00', home_team: 'Italia', away_team: 'Países Bajos' },

  // --- Grupo E ---
  { date: '2026-06-13', time: '18:00', home_team: 'Portugal', away_team: 'Bélgica' },
  { date: '2026-06-17', time: '20:30', home_team: 'Portugal', away_team: 'Croacia' },
  { date: '2026-06-21', time: '15:30', home_team: 'Bélgica', away_team: 'Croacia' },

  // --- Grupo F ---
  { date: '2026-06-14', time: '13:00', home_team: 'Japón', away_team: 'Corea del Sur' },
  { date: '2026-06-18', time: '15:30', home_team: 'Japón', away_team: 'Australia' },
  { date: '2026-06-22', time: '18:00', home_team: 'Corea del Sur', away_team: 'Australia' },

  // --- Grupo G ---
  { date: '2026-06-14', time: '18:00', home_team: 'Marruecos', away_team: 'Senegal' },
  { date: '2026-06-18', time: '20:30', home_team: 'Marruecos', away_team: 'Egipto' },
  { date: '2026-06-22', time: '15:30', home_team: 'Senegal', away_team: 'Egipto' },

  // --- Grupo H ---
  { date: '2026-06-15', time: '13:00', home_team: 'Colombia', away_team: 'Ecuador' },
  { date: '2026-06-19', time: '15:30', home_team: 'Colombia', away_team: 'Paraguay' },
  { date: '2026-06-23', time: '18:00', home_team: 'Ecuador', away_team: 'Paraguay' },

  // --- Grupo I ---
  { date: '2026-06-15', time: '18:00', home_team: 'Argelia', away_team: 'Costa de Marfil' },
  { date: '2026-06-19', time: '20:30', home_team: 'Argelia', away_team: 'Túnez' },
  { date: '2026-06-23', time: '15:30', home_team: 'Costa de Marfil', away_team: 'Túnez' },

  // --- Grupo J ---
  { date: '2026-06-16', time: '13:00', home_team: 'Irán', away_team: 'Arabia Saudita' },
  { date: '2026-06-20', time: '15:30', home_team: 'Irán', away_team: 'Catar' },
  { date: '2026-06-24', time: '18:00', home_team: 'Arabia Saudita', away_team: 'Catar' },

  // --- Grupo K ---
  { date: '2026-06-16', time: '18:00', home_team: 'Ghana', away_team: 'Cabo Verde' },
  { date: '2026-06-20', time: '20:30', home_team: 'Ghana', away_team: 'Sudáfrica' },
  { date: '2026-06-24', time: '15:30', home_team: 'Cabo Verde', away_team: 'Sudáfrica' },

  // --- Grupo L ---
  { date: '2026-06-17', time: '13:00', home_team: 'Irak', away_team: 'Jordania' },
  { date: '2026-06-21', time: '15:30', home_team: 'Irak', away_team: 'Uzbekistán' },
  { date: '2026-06-25', time: '18:00', home_team: 'Jordania', away_team: 'Uzbekistán' },
];

// =====================================================
// 2. EJECUTAR (no editar de acá en adelante)
// =====================================================

console.log(`Insertando ${matches.length} partidos de fase de grupos...\n`);

const insertStmt = db.prepare(`
  INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped = 0;

const insertMany = db.transaction((list) => {
  list.forEach((m) => {
    const exists = db.prepare(
      'SELECT id FROM matches WHERE date = ? AND home_team = ? AND away_team = ?'
    ).get(m.date, m.home_team, m.away_team);

    if (exists) {
      console.log(`  ⏭️  Ya existe: ${m.home_team} vs ${m.away_team} (${m.date})`);
      skipped++;
      return;
    }

    const id = generateId();
    insertStmt.run(id, m.date, m.time, m.home_team, m.away_team, null, null, 'open', 'group');
    console.log(`  ✅ ${m.date} ${m.time} | ${m.home_team} vs ${m.away_team}`);
    inserted++;
  });
});

insertMany(matches);

console.log(`\nResumen: ${inserted} insertados, ${skipped} ya existían`);

// =====================================================
// WHITELIST
// =====================================================
if (whitelistEmails.length > 0) {
  const existing = db.prepare("SELECT id FROM settings WHERE key = 'allowed_emails'").get();
  if (existing) {
    console.log('⏭️  Whitelist ya configurada, no se modificó');
  } else {
    const wid = generateId();
    db.prepare("INSERT INTO settings (id, key, value) VALUES (?, 'allowed_emails', ?)").run(wid, JSON.stringify(whitelistEmails));
    console.log(`✅ Whitelist configurada con ${whitelistEmails.length} correo(s)`);
  }
} else {
  console.log('⏭️  Whitelist vacía, todos pueden ingresar');
}

console.log(`\nPara ver los partidos desde la terminal:\n  sqlite3 data/mundial2026.db "SELECT date, time, home_team, away_team FROM matches WHERE round='group' ORDER BY date, time;"`);
