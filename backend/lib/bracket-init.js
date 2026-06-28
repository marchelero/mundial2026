const { db, generateId } = require('../db');
const path = require('path');
const fs = require('fs');

// Load group definitions from matches data (mismo source que /api/groups/standings)
const matchesPath = path.join(__dirname, '..', '..', 'data', 'matches.json');
let groupsData = [];
try {
  const data = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  groupsData = data.groups || [];
} catch (e) {
  console.error('[bracket-init] No se pudo cargar matches.json:', e.message);
  groupsData = [];
}

// Fixture oficial de los 16avos del Mundial 2026 (P73-P88, orden oficial)
// Horas oficiales FIFA convertidas a hora de Bolivia (UTC-4)
const R32_FIXTURE = [
  { pos: 1,  date: '2026-06-29', time: '16:30', home: 'Alemania',              away: 'Paraguay' },         // P73 - Boston (UTC-4, 16:30 local)
  { pos: 2,  date: '2026-06-30', time: '17:00', home: 'Francia',               away: 'Suecia' },           // P74 - NY/NJ (UTC-4, 17:00 local)
  { pos: 3,  date: '2026-06-28', time: '15:00', home: 'Sudáfrica',            away: 'Canadá' },           // P75 - LA (UTC-7, 12:00+3)
  { pos: 4,  date: '2026-06-29', time: '21:00', home: 'Países Bajos',          away: 'Marruecos' },        // P76 - Monterrey (UTC-6, 19:00+2)
  { pos: 5,  date: '2026-07-02', time: '19:00', home: 'Portugal',              away: 'Croacia' },          // P77 - Toronto (UTC-4, 19:00 local)
  { pos: 6,  date: '2026-07-02', time: '15:00', home: 'España',                away: 'Austria' },          // P78 - LA (UTC-7, 12:00+3)
  { pos: 7,  date: '2026-07-01', time: '20:00', home: 'Estados Unidos',        away: 'Bosnia y Herzegovina' }, // P79 - SF (UTC-7, 17:00+3)
  { pos: 8,  date: '2026-07-01', time: '16:00', home: 'Bélgica',               away: 'Senegal' },          // P80 - Seattle (UTC-7, 13:00+3)
  { pos: 9,  date: '2026-06-29', time: '13:00', home: 'Brasil',                away: 'Japón' },            // P81 - Houston (UTC-5, 12:00+1)
  { pos: 10, date: '2026-06-30', time: '13:00', home: 'Costa de Marfil',       away: 'Noruega' },          // P82 - Dallas (UTC-5, 12:00+1)
  { pos: 11, date: '2026-06-30', time: '21:00', home: 'México',                away: 'Ecuador' },          // P83 - CDMX (UTC-6, 19:00+2)
  { pos: 12, date: '2026-07-01', time: '12:00', home: 'Inglaterra',            away: 'Congo DR' },         // P84 - Atlanta (UTC-4, 12:00 local)
  { pos: 13, date: '2026-07-03', time: '18:00', home: 'Argentina',             away: 'Cabo Verde' },       // P85 - Miami (UTC-4, 18:00 local)
  { pos: 14, date: '2026-07-03', time: '14:00', home: 'Australia',             away: 'Egipto' },           // P86 - Dallas (UTC-5, 13:00+1)
  { pos: 15, date: '2026-07-02', time: '23:00', home: 'Suiza',                 away: 'Argelia' },          // P87 - Vancouver (UTC-7, 20:00+3)
  { pos: 16, date: '2026-07-03', time: '21:30', home: 'Colombia',              away: 'Ghana' },            // P88 - Kansas City (UTC-5, 20:30+1)
];

// Fixture de 8vos (P89-P96) y 4tos (P97-P100) — horas oficiales Bolivia UTC-4
const R16_FIXTURE = [
  { pos: 1, date: '2026-07-04', time: '17:00' },  // P89 - Filadelfia (UTC-4)
  { pos: 2, date: '2026-07-04', time: '13:00' },  // P90 - Houston (UTC-5, 12:00+1)
  { pos: 3, date: '2026-07-05', time: '16:00' },  // P91 - NY/NJ (UTC-4)
  { pos: 4, date: '2026-07-05', time: '20:00' },  // P92 - CDMX (UTC-6, 18:00+2)
  { pos: 5, date: '2026-07-06', time: '15:00' },  // P93 - Dallas (UTC-5, 14:00+1)
  { pos: 6, date: '2026-07-06', time: '20:00' },  // P94 - Seattle (UTC-7, 17:00+3)
  { pos: 7, date: '2026-07-07', time: '12:00' },  // P95 - Atlanta (UTC-4)
  { pos: 8, date: '2026-07-07', time: '16:00' },  // P96 - Vancouver (UTC-7, 13:00+3)
];
const QF_FIXTURE = [
  { pos: 1, date: '2026-07-09', time: '16:00' },  // P97 - Boston (UTC-4)
  { pos: 2, date: '2026-07-10', time: '15:00' },  // P98 - LA (UTC-7, 12:00+3)
  { pos: 3, date: '2026-07-11', time: '17:00' },  // P99 - Miami (UTC-4)
  { pos: 4, date: '2026-07-11', time: '21:00' },  // P100 - Kansas City (UTC-5, 20:00+1)
];

// Fechas y horas para las rondas finales (SF, 3er, Final)
const BRACKET_SCHEDULE = {
  r16: { start: '2026-07-04', end: '2026-07-07', times: ['12:00', '15:00', '18:00', '21:00'] },
  qf:  { start: '2026-07-11', end: '2026-07-12', times: ['15:00', '18:00', '21:00'] },
  sf:  { start: '2026-07-14', end: '2026-07-15', times: ['18:00', '21:00'] },
  third: { start: '2026-07-18', times: ['15:00'] },
  final: { start: '2026-07-19', times: ['21:00'] },
};

const ROUND_SLOTS = { r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 };

function dateRange(start, end) {
  const dates = [];
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function initBracket() {
  const existing = db.prepare("SELECT COUNT(*) as c FROM bracket_matches").get().c;
  if (existing > 0) {
    return { created: 0, message: 'Bracket ya existe' };
  }

  const insertMatch = db.prepare(`
    INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, 'open', ?)
  `);
  const insertBracket = db.prepare(`
    INSERT INTO bracket_matches (id, round, position, match_id, home_team, away_team, home_seed, away_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let created = 0;

  // R32: usar el fixture oficial
  for (const m of R32_FIXTURE) {
    const id = `r32_${m.pos}`;
    const matchId = generateId();
    insertMatch.run(matchId, m.date, m.time, m.home, m.away, 'round_16');
    insertBracket.run(id, 'r32', m.pos, matchId, m.home, m.away, null, null);
    created++;
  }

  // R16: usar el fixture oficial
  for (const m of R16_FIXTURE) {
    const id = `r16_${m.pos}`;
    const matchId = generateId();
    insertMatch.run(matchId, m.date, m.time, 'Por definir', 'Por definir', 'round_8');
    insertBracket.run(id, 'r16', m.pos, matchId, null, null, null, null);
    created++;
  }

  // QF: usar el fixture oficial
  for (const m of QF_FIXTURE) {
    const id = `qf_${m.pos}`;
    const matchId = generateId();
    insertMatch.run(matchId, m.date, m.time, 'Por definir', 'Por definir', 'quarter');
    insertBracket.run(id, 'qf', m.pos, matchId, null, null, null, null);
    created++;
  }

  // SF, third, final: fechas automaticas como antes
  for (const round of ['sf', 'third', 'final']) {
    const n = ROUND_SLOTS[round];
    const sched = BRACKET_SCHEDULE[round];
    const dates = sched.end ? dateRange(sched.start, sched.end) : [sched.start];
    const times = sched.times;

    for (let pos = 1; pos <= n; pos++) {
      const id = `${round}_${pos}`;
      const matchId = generateId();
      const date = dates[(pos - 1) % dates.length];
      const time = times[(pos - 1) % times.length];
      const roundDb = round === 'r16' ? 'round_8' : (round === 'qf' ? 'quarter' : (round === 'sf' ? 'semi' : (round === 'third' ? 'third' : 'final')));

      insertMatch.run(matchId, date, time, 'Por definir', 'Por definir', roundDb);
      insertBracket.run(id, round, pos, matchId, null, null, null, null);
      created++;
    }
  }

  return { created, message: `Bracket creado con ${created} partidos` };
}

function resetBracket(force = false) {
  const tx = db.transaction(() => {
    const matchIds = db.prepare("SELECT match_id FROM bracket_matches WHERE match_id IS NOT NULL").all().map(r => r.match_id).filter(Boolean);
    if (matchIds.length > 0) {
      const placeholders = matchIds.map(() => '?').join(',');
      if (!force) {
        const predCount = db.prepare(`SELECT COUNT(*) as c FROM predictions WHERE match_id IN (${placeholders})`).get(...matchIds).c;
        if (predCount > 0) {
          return { error: 'No se puede resetear: hay ' + predCount + ' pronosticos cargados. Use force=true para borrar todo.', predictionsCount: predCount };
        }
      }
      db.prepare(`DELETE FROM predictions WHERE match_id IN (${placeholders})`).run(matchIds);
      db.prepare(`DELETE FROM matches WHERE id IN (${placeholders})`).run(matchIds);
    }
    db.prepare("DELETE FROM bracket_matches").run();
    return { ok: true, deleted: matchIds.length, force };
  });
  return tx();
}

function getQualifiersFromGroups() {
  if (groupsData.length === 0) {
    return { qualifiers: [], calculated: false, reason: 'no_matches_json' };
  }

  const finishedMatches = db.prepare(`
    SELECT * FROM matches WHERE round = 'group' AND status = 'finished'
      AND home_score IS NOT NULL AND away_score IS NOT NULL
  `).all();

  const anyCalculated = finishedMatches.length > 0;

  // Calcular standings por grupo (misma logica que /api/groups/standings)
  const groupStandings = groupsData.map(g => {
    const teams = {};
    for (const name of g.teams) {
      teams[name] = { name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
    }
    for (const m of finishedMatches) {
      if (!teams[m.home_team] || !teams[m.away_team]) continue;
      const home = teams[m.home_team];
      const away = teams[m.away_team];
      home.pj++; away.pj++;
      home.gf += m.home_score; home.gc += m.away_score;
      away.gf += m.away_score; away.gc += m.home_score;
      if (m.home_score > m.away_score) { home.pg++; away.pp++; home.pts += 3; }
      else if (m.home_score < m.away_score) { away.pg++; home.pp++; away.pts += 3; }
      else { home.pe++; away.pe++; home.pts += 1; away.pts += 1; }
    }
    const sorted = Object.values(teams).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.gc, gdB = b.gf - b.gc;
      if (gdB !== gdA) return gdB - gdA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
    return { group: g.group, teams: sorted };
  });

  // Top 2 de cada grupo
  const qualifiers = [];
  for (const gs of groupStandings) {
    if (gs.teams[0]) qualifiers.push({ team: gs.teams[0].name, group: gs.group, seed: 1, pj: gs.teams[0].pj, pts: gs.teams[0].pts, gf: gs.teams[0].gf, gc: gs.teams[0].gc });
    if (gs.teams[1]) qualifiers.push({ team: gs.teams[1].name, group: gs.group, seed: 2, pj: gs.teams[1].pj, pts: gs.teams[1].pts, gf: gs.teams[1].gf, gc: gs.teams[1].gc });
  }

  // 8 mejores terceros
  const terceros = groupStandings
    .map(gs => gs.teams[2] ? { ...gs.teams[2], group: gs.group } : null)
    .filter(Boolean)
    .map(t => ({ team: t.name, group: t.group, seed: 3, pj: t.pj, pts: t.pts, gf: t.gf, gc: t.gc }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.gc, gdB = b.gf - b.gc;
      if (gdB !== gdA) return gdB - gdA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    })
    .slice(0, 8);

  // Standings por grupo (para resolver placeholders del fixture)
  const standingsByGroup = {};
  for (const gs of groupStandings) {
    standingsByGroup[gs.group] = gs.teams.map(t => t.name);
  }

  return {
    qualifiers: [...qualifiers, ...terceros],
    standingsByGroup,
    calculated: anyCalculated,
    groupsFound: groupsData.length,
    finishedMatches: finishedMatches.length,
  };
}

// Resolver placeholders del fixture oficial
// "1° X" → primer del grupo X
// "2° X" → segundo del grupo X
// "3° X/Y/Z" → mejor tercero entre los grupos X, Y, Z (entre los 8 que clasifican)
function resolveFixtureSlot(slot, standingsByGroup, qualifiedThirds) {
  if (!slot) return null;
  // Si ya es un equipo (no es placeholder), devolver tal cual
  if (!slot.startsWith('1°') && !slot.startsWith('2°') && !slot.startsWith('3°')) {
    return slot;
  }
  const seedMatch = slot.match(/^(\d)°\s*Grupo\s*([A-L])(?:\/([A-L]))?(?:\/([A-L]))?/);
  if (!seedMatch) return slot;
  const seed = parseInt(seedMatch[1], 10);
  const groups = [seedMatch[2], seedMatch[3], seedMatch[4]].filter(Boolean);
  if (seed === 1 || seed === 2) {
    const group = groups[0];
    const standing = standingsByGroup[group];
    if (standing && standing[seed - 1]) return standing[seed - 1];
    return null;
  }
  if (seed === 3) {
    // Buscar entre los grupos el 3° con mejor standing (menor idx en qualifiedThirds)
    let best = null;
    let bestIdx = Infinity;
    for (const g of groups) {
      const third = standingsByGroup[g]?.[2];
      if (!third) continue;
      const idx = qualifiedThirds.indexOf(third);
      if (idx === -1) continue; // no califica
      if (idx < bestIdx) {
        best = third;
        bestIdx = idx;
      }
    }
    return best;
  }
  return slot;
}

module.exports = { initBracket, resetBracket, getQualifiersFromGroups, resolveFixtureSlot, R32_FIXTURE, R16_FIXTURE, QF_FIXTURE, BRACKET_SCHEDULE, ROUND_SLOTS };
