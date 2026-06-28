const { db } = require('../db');

// Fixture oficial del Mundial 2026: cruces r32 → r16 (no consecutivos)
// Formato: cada r32_N va a un r16_M en home o away
// Mapeado del fixture:
//   P89 = r32_1 (home) + r32_4 (away)   → r16_1
//   P90 = r32_2 (home) + r32_5 (away)   → r16_2
//   P91 = r32_3 (home) + r32_6 (away)   → r16_3
//   P92 = r32_7 (home) + r32_8 (away)   → r16_4
//   P93 = r32_9 (home) + r32_10 (away)  → r16_5
//   P94 = r32_11 (home) + r32_12 (away) → r16_6
//   P95 = r32_13 (home) + r32_15 (away) → r16_7
//   P96 = r32_14 (home) + r32_16 (away) → r16_8
const R32_TO_R16 = {
  1:  { round: 'r16', position: 1, slot: 'home' },
  2:  { round: 'r16', position: 2, slot: 'home' },
  3:  { round: 'r16', position: 3, slot: 'home' },
  4:  { round: 'r16', position: 1, slot: 'away' },
  5:  { round: 'r16', position: 2, slot: 'away' },
  6:  { round: 'r16', position: 3, slot: 'away' },
  7:  { round: 'r16', position: 4, slot: 'home' },
  8:  { round: 'r16', position: 4, slot: 'away' },
  9:  { round: 'r16', position: 5, slot: 'home' },
  10: { round: 'r16', position: 5, slot: 'away' },
  11: { round: 'r16', position: 6, slot: 'home' },
  12: { round: 'r16', position: 6, slot: 'away' },
  13: { round: 'r16', position: 7, slot: 'home' },
  14: { round: 'r16', position: 8, slot: 'home' },
  15: { round: 'r16', position: 7, slot: 'away' },
  16: { round: 'r16', position: 8, slot: 'away' },
};

// Dado un round y position, devuelve el siguiente bracket_match
// r32: usa fixture oficial (no consecutivo)
// r16+: consecutivo (1+2, 3+4, etc)
// ademas, el perdedor de sf_X va a third_1 (siempre)
function getNextMatch(round, position, isLoser = false) {
  if (round === 'sf' && isLoser) {
    return { round: 'third', position: 1, slot: position === 1 ? 'home' : 'away' };
  }
  if (round === 'sf') {
    return { round: 'final', position: 1, slot: position === 1 ? 'home' : 'away' };
  }
  if (round === 'final' || round === 'third') {
    return null;
  }
  if (round === 'r32') {
    return R32_TO_R16[position] || null;
  }
  if (round === 'r16') {
    const nextPos = Math.ceil(position / 2);
    return { round: 'qf', position: nextPos, slot: position % 2 === 1 ? 'home' : 'away' };
  }
  if (round === 'qf') {
    const nextPos = Math.ceil(position / 2);
    return { round: 'sf', position: nextPos, slot: position % 2 === 1 ? 'home' : 'away' };
  }
  return null;
}

function propagateWinner(bracketId, winner) {
  // Obtener el bracket_match
  const bm = db.prepare("SELECT * FROM bracket_matches WHERE id = ?").get(bracketId);
  if (!bm) return { error: 'Bracket match no encontrado' };

  // Marcar ganador
  db.prepare("UPDATE bracket_matches SET winner = ? WHERE id = ?").run(winner, bracketId);

  // Propagar al siguiente
  const next = getNextMatch(bm.round, bm.position, false);
  if (next) {
    const winningTeam = winner === 'home' ? bm.home_team : bm.away_team;
    if (next.slot === 'home') {
      db.prepare("UPDATE bracket_matches SET home_team = ? WHERE round = ? AND position = ?").run(winningTeam, next.round, next.position);
    } else {
      db.prepare("UPDATE bracket_matches SET away_team = ? WHERE round = ? AND position = ?").run(winningTeam, next.round, next.position);
    }
  }

  // Si es SF, el perdedor va al partido de 3er lugar
  if (bm.round === 'sf') {
    const loserSlot = winner === 'home' ? 'away' : 'home';
    const losingTeam = winner === 'home' ? bm.away_team : bm.home_team;
    db.prepare(`UPDATE bracket_matches SET ${loserSlot}_team = ? WHERE round = 'third' AND position = 1`).run(losingTeam);
  }

  // Actualizar matches.home_team / away_team
  if (bm.match_id) {
    const updated = db.prepare("SELECT * FROM bracket_matches WHERE id = ?").get(bracketId);
    db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
      updated.home_team || 'Por definir',
      updated.away_team || 'Por definir',
      bm.match_id
    );
  }
  if (next) {
    const nextBm = db.prepare("SELECT * FROM bracket_matches WHERE round = ? AND position = ?").get(next.round, next.position);
    if (nextBm && nextBm.match_id) {
      const refreshed = db.prepare("SELECT * FROM bracket_matches WHERE round = ? AND position = ?").get(next.round, next.position);
      db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
        refreshed.home_team || 'Por definir',
        refreshed.away_team || 'Por definir',
        nextBm.match_id
      );
    }
  }
  if (bm.round === 'sf') {
    const thirdBm = db.prepare("SELECT * FROM bracket_matches WHERE round = 'third' AND position = 1").get();
    if (thirdBm && thirdBm.match_id) {
      db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
        thirdBm.home_team || 'Por definir',
        thirdBm.away_team || 'Por definir',
        thirdBm.match_id
      );
    }
  }

  return { ok: true, propagated: next, winner };
}

function setTeam(bracketId, slot, team, seed) {
  const bm = db.prepare("SELECT * FROM bracket_matches WHERE id = ?").get(bracketId);
  if (!bm) return { error: 'Bracket match no encontrado' };
  if (slot !== 'home' && slot !== 'away') return { error: 'slot invalido' };

  db.prepare(`UPDATE bracket_matches SET ${slot}_team = ?, ${slot}_seed = ? WHERE id = ?`).run(team, seed || null, bracketId);

  if (bm.match_id) {
    const updated = db.prepare("SELECT * FROM bracket_matches WHERE id = ?").get(bracketId);
    db.prepare("UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?").run(
      updated.home_team || 'Por definir',
      updated.away_team || 'Por definir',
      bm.match_id
    );
  }

  return { ok: true };
}

function getBracket() {
  const rows = db.prepare("SELECT * FROM bracket_matches ORDER BY round, position").all();
  const matches = db.prepare(`
    SELECT id, date, time, home_score, away_score, status FROM matches
    WHERE id IN (SELECT match_id FROM bracket_matches WHERE match_id IS NOT NULL)
  `).all();
  const matchMap = {};
  for (const m of matches) matchMap[m.id] = m;

  const out = { r32: [], r16: [], qf: [], sf: [], third: [], final: [] };
  for (const r of rows) {
    const m = r.match_id ? matchMap[r.match_id] : null;
    out[r.round].push({
      id: r.id,
      position: r.position,
      home_team: r.home_team,
      away_team: r.away_team,
      home_seed: r.home_seed,
      away_seed: r.away_seed,
      winner: r.winner,
      match_id: r.match_id,
      match_date: m?.date || null,
      match_time: m?.time || null,
      home_score: m?.home_score,
      away_score: m?.away_score,
      status: m?.status,
    });
  }
  return out;
}

module.exports = { getNextMatch, propagateWinner, setTeam, getBracket };
