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

// Fechas y horas del Mundial 2026 para las rondas eliminatorias
const BRACKET_SCHEDULE = {
  r32: { start: '2026-06-28', end: '2026-07-03', times: ['12:00', '15:00', '18:00', '21:00'] },
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
  for (const round of Object.keys(ROUND_SLOTS)) {
    const n = ROUND_SLOTS[round];
    const sched = BRACKET_SCHEDULE[round];
    const dates = sched.end ? dateRange(sched.start, sched.end) : [sched.start];
    const times = sched.times;

    for (let pos = 1; pos <= n; pos++) {
      const id = `${round}_${pos}`;
      const matchId = generateId();
      const date = dates[(pos - 1) % dates.length];
      const time = times[(pos - 1) % times.length];
      const roundDb = round === 'r32' ? 'round_16' : (round === 'r16' ? 'round_8' : (round === 'qf' ? 'quarter' : (round === 'sf' ? 'semi' : (round === 'third' ? 'third' : 'final'))));

      insertMatch.run(matchId, date, time, 'Por definir', 'Por definir', roundDb);
      insertBracket.run(id, round, pos, matchId, null, null, null, null);
      created++;
    }
  }

  return { created, message: `Bracket creado con ${created} partidos` };
}

function resetBracket() {
  const tx = db.transaction(() => {
    const matchIds = db.prepare("SELECT match_id FROM bracket_matches WHERE match_id IS NOT NULL").all().map(r => r.match_id);
    if (matchIds.length > 0) {
      const placeholders = matchIds.map(() => '?').join(',');
      const predCount = db.prepare(`SELECT COUNT(*) as c FROM predictions WHERE match_id IN (${placeholders})`).get(...matchIds).c;
      if (predCount > 0) {
        return { error: 'No se puede resetear: hay ' + predCount + ' pronosticos cargados' };
      }
      db.prepare(`DELETE FROM matches WHERE id IN (${placeholders})`).run(matchIds);
    }
    db.prepare("DELETE FROM bracket_matches").run();
    return { ok: true };
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

  return {
    qualifiers: [...qualifiers, ...terceros],
    calculated: anyCalculated,
    groupsFound: groupsData.length,
    finishedMatches: finishedMatches.length,
  };
}

module.exports = { initBracket, resetBracket, getQualifiersFromGroups, BRACKET_SCHEDULE, ROUND_SLOTS };
