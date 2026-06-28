const { db } = require('../db');

// Dado un round y position, devuelve el siguiente bracket_match
// Fixture oficial: TODOS los cruces son consecutivos (1+2, 3+4, etc)
// r32: 16 -> r16: 8 (1+2 -> r16_1, 3+4 -> r16_2, etc)
// r16: 8 -> qf: 4
// qf: 4 -> sf: 2
// sf: 2 -> final: 1
// ademas, el perdedor de sf_X va a third_1
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
  const nextPos = Math.ceil(position / 2);
  const slot = position % 2 === 1 ? 'home' : 'away';
  if (round === 'r32') return { round: 'r16', position: nextPos, slot };
  if (round === 'r16') return { round: 'qf', position: nextPos, slot };
  if (round === 'qf') return { round: 'sf', position: nextPos, slot };
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
  // SF1 → home, SF2 → away (fijo, no depende de quien gano)
  if (bm.round === 'sf') {
    const losingTeam = winner === 'home' ? bm.away_team : bm.home_team;
    const slot = bm.position === 1 ? 'home' : 'away';
    db.prepare(`UPDATE bracket_matches SET ${slot}_team = ? WHERE round = 'third' AND position = 1`).run(losingTeam);
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
