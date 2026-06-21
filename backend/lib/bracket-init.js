// Auto-init del bracket: corre en el startup del server.
// Idempotente: si la tabla bracket ya tiene filas, no hace nada.
// Si está vacía, siembra:
//   - tabla bracket: 32 partidos (R32 + R16 + QF + SF + Third + Final)
//     con la estructura de fechas/horarios/etiquetas. Los nombres de
//     equipos quedan en NULL hasta /api/bracket/refresh-r32.
//   - tabla matches: 16 partidos para la ronda de 16avos (BRACKET_ROUND),
//     para que los usuarios puedan pronosticar. Se usan los labels
//     (ej. "2A", "1E") como placeholders de home/away hasta que se
//     refresquen los nombres reales.
const { R32_PAIRINGS, NEXT_ROUND_SCHEDULE, BRACKET_ROUND, BRACKET_INTERNAL_KEY } = require('../bracket-data');

function idFor(round, position) {
  return `${round}_${String(position).padStart(2, '0')}`;
}

function autoInitBracket() {
  const count = require('../db').db.prepare('SELECT COUNT(*) as c FROM bracket').get().c;
  if (count > 0) {
    console.log(`[bracket] ${count} partidos cargados — skip auto-init`);
    return { skipped: true, count };
  }

  console.log('[bracket] tabla vacía — auto-inicializando estructura (R32..Final)…');
  const db = require('../db').db;

  const insertBracket = db.prepare(`INSERT INTO bracket (id, round, position, home_team, away_team, home_label, away_label, match_date, match_time, home_from, away_from)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMatch = db.prepare(`INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
                                  VALUES (?, ?, ?, ?, ?, NULL, NULL, 'open', ?)`);

  const txn = db.transaction(() => {
    R32_PAIRINGS.forEach((p, idx) => {
      const isThirdPool = !!p.thirdPool;
      const awayLabelBracket = isThirdPool ? `3°[${p.thirdPool.join('/')}]` : p.away;
      // En matches, home/away son NOT NULL → usamos labels como placeholder.
      const homeMatch = p.home;
      const awayMatch = isThirdPool ? '3°' : p.away;

      insertBracket.run(
        p.id, BRACKET_INTERNAL_KEY, idx + 1,
        null, null,
        p.home, awayLabelBracket,
        p.date, p.time,
        null, null
      );

      insertMatch.run(
        p.id, p.date, p.time,
        homeMatch, awayMatch,
        BRACKET_ROUND
      );
    });

    for (let i = 1; i <= 8; i++) {
      const s = NEXT_ROUND_SCHEDULE.r16[i - 1] || { date: '2026-07-07', time: '16:00' };
      insertBracket.run(
        idFor('r16', i), 'r16', i,
        null, null, null, null,
        s.date, s.time,
        R32_PAIRINGS[(i - 1) * 2].id, R32_PAIRINGS[(i - 1) * 2 + 1].id
      );
    }

    for (let i = 1; i <= 4; i++) {
      const s = NEXT_ROUND_SCHEDULE.qf[i - 1] || { date: '2026-07-12', time: '16:00' };
      insertBracket.run(
        idFor('qf', i), 'qf', i,
        null, null, null, null,
        s.date, s.time,
        idFor('r16', (i - 1) * 2 + 1), idFor('r16', (i - 1) * 2 + 2)
      );
    }

    for (let i = 1; i <= 2; i++) {
      const s = NEXT_ROUND_SCHEDULE.sf[i - 1] || { date: '2026-07-15', time: '15:00' };
      insertBracket.run(
        idFor('sf', i), 'sf', i,
        null, null, null, null,
        s.date, s.time,
        idFor('qf', (i - 1) * 2 + 1), idFor('qf', (i - 1) * 2 + 2)
      );
    }

    const tSched = NEXT_ROUND_SCHEDULE.third[0];
    insertBracket.run(
      idFor('third', 1), 'third', 1,
      null, null, null, null,
      tSched.date, tSched.time,
      idFor('sf', 1), idFor('sf', 2)
    );

    const fSched = NEXT_ROUND_SCHEDULE.final[0];
    insertBracket.run(
      idFor('final', 1), 'final', 1,
      null, null, null, null,
      fSched.date, fSched.time,
      idFor('sf', 1), idFor('sf', 2)
    );
  });

  txn();
  const total = R32_PAIRINGS.length + 8 + 4 + 2 + 1 + 1;
  console.log(`[bracket] auto-init OK: ${total} filas en bracket + ${R32_PAIRINGS.length} partidos en matches (round=${BRACKET_ROUND})`);
  return { skipped: false, count: total };
}

module.exports = { autoInitBracket };
