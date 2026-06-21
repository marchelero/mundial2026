const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { R32_PAIRINGS, NEXT_ROUND_SCHEDULE, BRACKET_ROUND, BRACKET_INTERNAL_KEY } = require('../bracket-data');
const {
  getMatchById,
  getMatchByRoundPos,
  nextRoundOf,
  setBracketWinner,
  maybeCreateNextRoundMatch,
  clearDownstream,
} = require('../lib/bracket-flow');

const router = express.Router();

const ROUND_DEFINITIONS = {
  r32:  { count: 16, label: 'Dieciseisavos' },
  r16:  { count: 8,  label: 'Octavos' },
  qf:   { count: 4,  label: 'Cuartos' },
  sf:   { count: 2,  label: 'Semifinales' },
  third:{ count: 1,  label: 'Tercer lugar' },
  final:{ count: 1,  label: 'Final' },
};

// R32_PAIRINGS y NEXT_ROUND_SCHEDULE importados desde ../bracket-data
// para mantener una única fuente de verdad (compartida con lib/bracket-init.js).

// FIFA 2026 3rd place matrix: for each combination of 8 qualifying 3rd place groups,
// assigns which 3rd place team goes to which match (601-608).
// Each entry is keyed by a sorted string of the 8 qualifying group letters.
// The value is an array of 8 group letters, in order of matches 601-608 (index 0 = match 601).
// Falls back to greedy assignment if exact combination not found.
const FIFA_THIRD_PLACE_MATRIX = {
  // All 8 best 3rd from groups A-H (top 8 alphabetical)
  'ABCDEFGH': ['C', 'E', 'F', 'A', 'A', 'C', 'D', 'E'],
  // 8 best 3rd from groups A-H excluding some, including I-L
  'ABCDEFGHI': null, // fallback to greedy
  'ABCDEFGHIJ': null,
  'ABCDEFGHIJK': null,
  'ABCDEFGHIJKL': null,
};

function idFor(round, position) {
  const prefix = { r32: 'r32', r16: 'r16', qf: 'qf', sf: 'sf', final: 'final' }[round];
  return `${prefix}_${String(position).padStart(2, '0')}`;
}

function buildBracketFromStandings(standings) {
  const map = {};
  const thirdPlace = [];
  for (const g of standings) {
    const letter = g.group;
    const teams = g.teams || [];
    if (teams[0]) map[`1${letter}`] = teams[0].name;
    if (teams[1]) map[`2${letter}`] = teams[1].name;
    if (teams[2]) thirdPlace.push({
      key: `3${letter}`, name: teams[2].name,
      pts: teams[2].pts || 0, gd: (teams[2].gf || 0) - (teams[2].gc || 0), gf: teams[2].gf || 0,
    });
  }
  thirdPlace.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
  const best8 = thirdPlace.slice(0, 8);
  for (let i = 0; i < best8.length; i++) {
    map[best8[i].key] = best8[i].name;
  }
  return map;
}

// FIFA 2026 3rd place assignment: maps which 3rd place team goes to which match (601-608)
// based on the 8 qualifying 3rd place groups. Uses official FIFA matrix when available,
// otherwise greedy fallback using the priority lists from R32_PAIRINGS.
function assignThirdPlaceTeams(standings) {
  // 1) Build full 3rd place standings (all 12 groups) and identify the top 8
  const all3rd = [];
  for (const g of standings) {
    const teams = g.teams || [];
    if (teams[2]) {
      all3rd.push({
        letter: g.group,
        name: teams[2].name,
        pts: teams[2].pts || 0,
        gd: (teams[2].gf || 0) - (teams[2].gc || 0),
        gf: teams[2].gf || 0,
      });
    }
  }
  all3rd.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
  const top8 = all3rd.slice(0, 8);
  const top8Letters = top8.map(t => t.letter).sort();

  // 2) Try official FIFA matrix
  const matrixKey = top8Letters.join('');
  const matrixEntry = FIFA_THIRD_PLACE_MATRIX[matrixKey];

  // Get 3rd place matches (601-608)
  const thirdMatches = R32_PAIRINGS.filter(p => p.thirdPool);

  if (matrixEntry && Array.isArray(matrixEntry)) {
    // matrixEntry[i] is the group letter that plays in match thirdMatches[i]
    for (let i = 0; i < thirdMatches.length; i++) {
      const grpLetter = matrixEntry[i];
      const team = all3rd.find(t => t.letter === grpLetter);
      if (team) thirdMatches[i].resolvedThird = team.name;
    }
  } else {
    // Greedy fallback: for each match in order, pick the first preferred 3rd place group
    // that is among the top 8 and hasn't been used yet
    const usedLetters = new Set();
    for (const m of thirdMatches) {
      for (const candidate of m.thirdPool) {
        if (top8Letters.includes(candidate) && !usedLetters.has(candidate)) {
          const team = all3rd.find(t => t.letter === candidate);
          if (team) {
            m.resolvedThird = team.name;
            usedLetters.add(candidate);
            break;
          }
        }
      }
    }
  }
  return thirdMatches;
}

function getStandingsSafe() {
  try {
    const finishedMatches = db.prepare(`SELECT * FROM matches WHERE round = 'group' AND status = 'finished'`).all();
    const matchesPath = require('path').join(__dirname, '..', '..', 'data', 'matches.json');
    const matchesData = JSON.parse(require('fs').readFileSync(matchesPath, 'utf8'));
    return matchesData.groups.map(g => {
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
      return { group: g.group, teams: sorted, played: sorted.some(t => t.pj > 0) };
    });
  } catch (e) {
    return [];
  }
}

router.get('/', authRequired, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM bracket ORDER BY round, position').all();
    const result = {};
    for (const round of Object.keys(ROUND_DEFINITIONS)) {
      result[round] = rows.filter(r => r.round === round);
    }
    res.json(result);
  } catch (e) {
    console.error('[bracket] get error:', e.message);
    res.status(500).json({ error: 'Error al obtener bracket' });
  }
});

router.post('/init', authRequired, adminRequired, (req, res) => {
  try {
    const existing = db.prepare('SELECT COUNT(*) as c FROM bracket').get();
    if (existing.c > 0) {
      return res.status(400).json({ error: 'El bracket ya está inicializado. Usá /reset para reiniciar.' });
    }
    const standings = getStandingsSafe();
    const map = buildBracketFromStandings(standings);
    const thirdMatches = assignThirdPlaceTeams(standings);

    const insertBracket = db.prepare(`INSERT INTO bracket (id, round, position, home_team, away_team, home_label, away_label, match_date, match_time, home_from, away_from)
                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    // matches.home_team/away_team son NOT NULL → si standings está vacío
    // usamos los labels (ej. "2A", "1E") como placeholder. /refresh-r32
    // los reemplaza por los nombres reales una vez terminada la fase de grupos.
    const insertMatch = db.prepare(`INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
                                    VALUES (?, ?, ?, ?, ?, NULL, NULL, 'open', ?)`);

    const txn = db.transaction(() => {
      // R32: 16 partidos oficiales FIFA 2026 en orden cronológico (R32_01..R32_16)
      R32_PAIRINGS.forEach((p, idx) => {
        const sched = { date: p.date, time: p.time };
        const matchId = p.id;
        let homeTeam = null, awayTeam = null;
        let homeLabel = null, awayLabel = null;
        // `third` lo declaramos en el scope del forEach (no dentro del if)
        // porque lo usamos también más abajo para el mirror a `matches`.
        const third = p.thirdPool ? thirdMatches.find(tm => tm.id === p.id) : null;
        if (p.thirdPool) {
          // 1st place vs 3rd place
          homeLabel = p.home;
          homeTeam = map[p.home] || null;
          awayLabel = third && third.resolvedThird ? `3°${third.id.charAt(0) || ''}` : null;
          // Use the 3rd place team's group letter as label (from the resolved team)
          if (third && third.resolvedThird) {
            const all3rd = [];
            for (const g of standings) {
              const teams = g.teams || [];
              if (teams[2] && teams[2].name === third.resolvedThird) {
                awayLabel = `3°${g.group}`;
                break;
              }
            }
          }
          awayTeam = third && third.resolvedThird ? third.resolvedThird : null;
        } else {
          // Direct matchup
          homeLabel = p.home;
          awayLabel = p.away;
          homeTeam = map[p.home] || null;
          awayTeam = map[p.away] || null;
        }
        insertBracket.run(
          matchId,
          BRACKET_INTERNAL_KEY, idx + 1,
          homeTeam, awayTeam,
          homeLabel, awayLabel,
          sched.date, sched.time,
          null, null
        );

        // Mirror en tabla matches para que los usuarios puedan pronosticar.
        // Si tenemos el nombre real (map), lo usamos; si no, usamos el label.
        const homeMatch = map[p.home] || p.home;
        const awayMatch = p.thirdPool
          ? (third && third.resolvedThird ? third.resolvedThird : '3°')
          : (map[p.away] || p.away);
        insertMatch.run(
          matchId, p.date, p.time,
          homeMatch, awayMatch,
          BRACKET_ROUND
        );
      });

      // R16: 8 matches (601-602 → R16-1, 603-604 → R16-2, etc.)
      for (let i = 1; i <= 8; i++) {
        const sched = NEXT_ROUND_SCHEDULE.r16[i - 1] || { date: '2026-07-07', time: '16:00' };
        insertBracket.run(
          idFor('r16', i), 'r16', i,
          null, null, null, null,
          sched.date, sched.time,
          R32_PAIRINGS[(i - 1) * 2].id, R32_PAIRINGS[(i - 1) * 2 + 1].id
        );
      }

      // QF: 4 matches
      for (let i = 1; i <= 4; i++) {
        const sched = NEXT_ROUND_SCHEDULE.qf[i - 1] || { date: '2026-07-12', time: '16:00' };
        insertBracket.run(
          idFor('qf', i), 'qf', i,
          null, null, null, null,
          sched.date, sched.time,
          idFor('r16', (i - 1) * 2 + 1), idFor('r16', (i - 1) * 2 + 2)
        );
      }

      // SF: 2 matches
      for (let i = 1; i <= 2; i++) {
        const sched = NEXT_ROUND_SCHEDULE.sf[i - 1] || { date: '2026-07-15', time: '15:00' };
        insertBracket.run(
          idFor('sf', i), 'sf', i,
          null, null, null, null,
          sched.date, sched.time,
          idFor('qf', (i - 1) * 2 + 1), idFor('qf', (i - 1) * 2 + 2)
        );
      }

      // 3rd place match
      const tSched = NEXT_ROUND_SCHEDULE.third[0];
      insertBracket.run(
        idFor('third', 1), 'third', 1,
        null, null, null, null,
        tSched.date, tSched.time,
        idFor('sf', 1), idFor('sf', 2)
      );

      // Final
      const fSched = NEXT_ROUND_SCHEDULE.final[0];
      insertBracket.run(
        idFor('final', 1), 'final', 1,
        null, null, null, null,
        fSched.date, fSched.time,
        idFor('sf', 1), idFor('sf', 2)
      );
    });

    txn();
    const r32Count = R32_PAIRINGS.length;
    res.json({ ok: true, message: `Bracket inicializado: ${r32Count} partidos de dieciseisavos + ${r32Count} partidos en matches (round=${BRACKET_ROUND})` });
  } catch (e) {
    console.error('[bracket] init error:', e.message);
    res.status(500).json({ error: 'Error al inicializar bracket: ' + e.message });
  }
});

router.post('/reset', authRequired, adminRequired, (req, res) => {
  try {
    // Guard: si al menos un partido de la ronda de 16avos está finalizado
    // (status='finished'), NO permitimos resetear. Eso preserva la integridad
    // de los puntos ya otorgados a los usuarios.
    const finished = db.prepare(
      `SELECT COUNT(*) as c FROM matches WHERE round = ? AND status = 'finished'`
    ).get(BRACKET_ROUND).c;
    if (finished > 0) {
      return res.status(400).json({
        error: `No se puede resetear: ya hay ${finished} partido(s) de ${BRACKET_ROUND} finalizado(s). Si necesitás reiniciar, contactá al super-admin.`,
      });
    }

    const txn = db.transaction(() => {
      const matchesDeleted = db.prepare(`DELETE FROM matches WHERE round = ?`).run(BRACKET_ROUND).changes;
      const bracketDeleted = db.prepare(`DELETE FROM bracket`).run().changes;
      return { matchesDeleted, bracketDeleted };
    });
    const { matchesDeleted, bracketDeleted } = txn();
    res.json({
      ok: true,
      message: `Bracket reiniciado: ${bracketDeleted} filas en bracket + ${matchesDeleted} partidos en matches (round=${BRACKET_ROUND}) borrados`,
    });
  } catch (e) {
    console.error('[bracket] reset error:', e.message);
    res.status(500).json({ error: 'Error al reiniciar bracket' });
  }
});

router.post('/refresh-r32', authRequired, adminRequired, (req, res) => {
  try {
    const standings = getStandingsSafe();
    const map = buildBracketFromStandings(standings);
    const thirdMatches = assignThirdPlaceTeams(standings);
    const updateBracketHome = db.prepare('UPDATE bracket SET home_team = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const updateBracketAway = db.prepare('UPDATE bracket SET away_team = ?, away_label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    // También sincronizamos los nombres en `matches` (que es lo que ve el
    // usuario al pronosticar). Solo si el partido aún no fue finalizado
    // (status != 'finished'), para no pisar resultados reales.
    const updateMatch = db.prepare(`UPDATE matches
                                    SET home_team = ?, away_team = ?
                                    WHERE id = ? AND status != 'finished'`);
    const txn = db.transaction(() => {
      R32_PAIRINGS.forEach((p) => {
        if (p.thirdPool) {
          const homeName = map[p.home] || p.home;
          updateBracketHome.run(homeName, p.id);
          const third = thirdMatches.find(tm => tm.id === p.id);
          let newLabel = null;
          let awayName = '3°';
          if (third && third.resolvedThird) {
            const grp = standings.find(g => g.teams && g.teams[2] && g.teams[2].name === third.resolvedThird);
            if (grp) newLabel = `3°${grp.group}`;
            awayName = third.resolvedThird;
          }
          updateBracketAway.run(third && third.resolvedThird ? third.resolvedThird : null, newLabel, p.id);
          updateMatch.run(homeName, awayName, p.id);
        } else {
          const homeName = map[p.home] || p.home;
          const awayName = map[p.away] || p.away;
          updateBracketHome.run(homeName, p.id);
          updateBracketAway.run(awayName, p.away, p.id);
          updateMatch.run(homeName, awayName, p.id);
        }
      });
    });
    txn();
    res.json({ ok: true, message: `Equipos de ${BRACKET_ROUND} actualizados desde la tabla de grupos (bracket + matches sincronizados)` });
  } catch (e) {
    console.error('[bracket] refresh-r32 error:', e.message);
    res.status(500).json({ error: 'Error al refrescar R32' });
  }
});

router.post('/match/:id/winner', authRequired, adminRequired, (req, res) => {
  try {
    const { id } = req.params;
    const { winner } = req.body;
    if (!['home', 'away', null].includes(winner) && winner !== '') {
      return res.status(400).json({ error: 'winner debe ser "home", "away" o null' });
    }
    const w = (winner === '' || winner === null) ? null : winner;
    const result = setBracketWinner(id, w);
    if (!result.ok) {
      if (result.error === 'Match no encontrado en bracket') return res.status(404).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    const msg = w === null
      ? 'Ganador limpiado'
      : 'Ganador guardado y avanzado (próximo match creado en `matches` si aplica)';
    res.json({ ok: true, message: msg });
  } catch (e) {
    console.error('[bracket] winner error:', e.message);
    res.status(500).json({ error: 'Error al guardar ganador' });
  }
});

router.put('/match/:id', authRequired, adminRequired, (req, res) => {
  try {
    const { id } = req.params;
    const { home_team, away_team, match_date, match_time } = req.body;
    const match = getMatchById(id);
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    db.prepare(`UPDATE bracket SET
      home_team = COALESCE(?, home_team),
      away_team = COALESCE(?, away_team),
      match_date = COALESCE(?, match_date),
      match_time = COALESCE(?, match_time),
      winner = NULL,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).run(home_team, away_team, match_date, match_time, id);
    res.json({ ok: true, message: 'Partido actualizado' });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar partido' });
  }
});

module.exports = router;
