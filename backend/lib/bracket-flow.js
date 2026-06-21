// Lógica de propagación del bracket, compartida entre routes/bracket.js y routes/matches.js.
// Incluye la creación dinámica de partidos en la tabla `matches` cuando los 2 equipos
// de un match de la siguiente ronda quedan determinados.
const { db } = require('../db');
const { NEXT_ROUND_SCHEDULE } = require('../bracket-data');

const ROUND_NEXT = { r32: 'r16', r16: 'qf', qf: 'sf', sf: 'final' };
const ROUND_POSITIONS = { r16: 8, qf: 4, sf: 2, third: 1, final: 1 };
const ROUND_LABEL = { r16: 'Octavos', qf: 'Cuartos', sf: 'Semis', third: '3.er lugar', final: 'Final' };

function getMatchById(id) {
  return db.prepare('SELECT * FROM bracket WHERE id = ?').get(id);
}
function getMatchByRoundPos(round, position) {
  return db.prepare('SELECT * FROM bracket WHERE round = ? AND position = ?').get(round, position);
}
function getChildren(matchId) {
  const m = getMatchById(matchId);
  if (!m || !m.home_from || !m.away_from) return { home: null, away: null };
  return { home: getMatchById(m.home_from), away: getMatchById(m.away_from) };
}
function nextRoundOf(round) { return ROUND_NEXT[round] || null; }

// Devuelve el schedule (date/time) para un partido del bracket segun su round y position.
function getScheduleFor(round, position) {
  const arr = NEXT_ROUND_SCHEDULE[round];
  if (arr && arr[position - 1]) return arr[position - 1];
  // Fallbacks defensivos (no deberia pasar si NEXT_ROUND_SCHEDULE esta bien armado)
  const fallbacks = {
    r16:  { date: '2026-07-07', time: '16:00' },
    qf:   { date: '2026-07-12', time: '16:00' },
    sf:   { date: '2026-07-15', time: '15:00' },
    third:{ date: '2026-07-18', time: '15:00' },
    final:{ date: '2026-07-19', time: '15:00' },
  };
  return fallbacks[round] || { date: '2026-07-19', time: '15:00' };
}

// Setea el ganador ('home' | 'away' | null) en un match de bracket y propaga al siguiente.
// Si el match hijo (siguiente ronda) tiene ambos equipos llenos, crea el partido en
// `matches` (idempotente: no duplica si ya existe).
function setBracketWinner(matchId, winner) {
  const match = getMatchById(matchId);
  if (!match) return { ok: false, error: 'Match no encontrado en bracket' };

  // Limpiar ganador anterior y propagar al reves
  clearDownstreamInternal(matchId);

  if (winner === null) {
    db.prepare('UPDATE bracket SET winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(matchId);
    return { ok: true, winner: null };
  }

  if (winner !== 'home' && winner !== 'away') {
    return { ok: false, error: 'winner debe ser "home" o "away"' };
  }
  if (winner === 'home' && !match.home_team) return { ok: false, error: 'No hay equipo local' };
  if (winner === 'away' && !match.away_team) return { ok: false, error: 'No hay equipo visitante' };

  const winningTeam = winner === 'home' ? match.home_team : match.away_team;
  const losingTeam = winner === 'home' ? match.away_team : match.home_team;

  db.prepare('UPDATE bracket SET winner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(winner, matchId);

  // Propagar al siguiente match
  const nextRound = nextRoundOf(match.round);
  if (nextRound) {
    const childPos = Math.ceil(match.position / 2);
    const child = getMatchByRoundPos(nextRound, childPos);
    if (child) {
      const isHomeSlot = match.position % 2 === 1;
      const slotCol = isHomeSlot ? 'home_team' : 'away_team';
      db.prepare(`UPDATE bracket SET ${slotCol} = ?, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(winningTeam, child.id);
      // Re-leer el child ya actualizado para chequear si quedó completo
      const childUpdated = getMatchById(child.id);
      maybeCreateNextRoundMatch(childUpdated);
    }
  }
  // Si es SF, los perdedores van al partido por el 3.er lugar
  if (match.round === 'sf') {
    const third = getMatchByRoundPos('third', 1);
    if (third) {
      const isHomeSlot = match.position === 1;
      const slotCol = isHomeSlot ? 'home_team' : 'away_team';
      db.prepare(`UPDATE bracket SET ${slotCol} = ?, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(losingTeam, third.id);
      const thirdUpdated = getMatchById(third.id);
      maybeCreateNextRoundMatch(thirdUpdated);
    }
  }
  return { ok: true, winner, nextRound: nextRound || null };
}

function clearDownstreamInternal(matchId) {
  const match = getMatchById(matchId);
  if (!match) return;
  const nextRound = nextRoundOf(match.round);
  if (nextRound) {
    const childPos = Math.ceil(match.position / 2);
    const child = getMatchByRoundPos(nextRound, childPos);
    if (child) {
      const isHomeSlot = match.position % 2 === 1;
      const slotCol = isHomeSlot ? 'home_team' : 'away_team';
      // Solo limpiar el slot que ESTE match alimenta
      if (isHomeSlot) {
        db.prepare('UPDATE bracket SET home_team = NULL, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(child.id);
      } else {
        db.prepare('UPDATE bracket SET away_team = NULL, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(child.id);
      }
      // Si después de limpiar el slot, el match del bracket hijo ya no califica como
      // "completo" (le falta un equipo) y existe en `matches`, también lo borramos de
      // `matches` para que no quede pronosticable un partido sin equipo.
      const refreshed = getMatchById(child.id);
      if (refreshed && (!refreshed.home_team || !refreshed.away_team)) {
        db.prepare('DELETE FROM matches WHERE id = ?').run(child.id);
      }
    }
  }
  if (match.round === 'sf') {
    const third = getMatchByRoundPos('third', 1);
    if (third) {
      const isHomeSlot = match.position === 1;
      if (isHomeSlot) {
        db.prepare('UPDATE bracket SET home_team = NULL, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(third.id);
      } else {
        db.prepare('UPDATE bracket SET away_team = NULL, winner = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(third.id);
      }
      const refreshed = getMatchById(third.id);
      if (refreshed && (!refreshed.home_team || !refreshed.away_team)) {
        db.prepare('DELETE FROM matches WHERE id = ?').run(third.id);
      }
    }
  }
}

// Crea el match en `matches` si el match del bracket tiene AMBOS equipos Y no existe
// en `matches`. No-op para R32 (esos se crean en init/auto-init).
function maybeCreateNextRoundMatch(childBracketRow) {
  if (!childBracketRow) return false;
  if (childBracketRow.round === 'r32') return false; // R32 ya existe desde init
  if (!childBracketRow.home_team || !childBracketRow.away_team) return false;
  const exists = db.prepare('SELECT id FROM matches WHERE id = ?').get(childBracketRow.id);
  if (exists) return false;
  const sched = getScheduleFor(childBracketRow.round, childBracketRow.position);
  db.prepare(`INSERT INTO matches (id, date, time, home_team, away_team, home_score, away_score, status, round)
              VALUES (?, ?, ?, ?, ?, NULL, NULL, 'open', ?)`).run(
    childBracketRow.id,
    sched.date, sched.time,
    childBracketRow.home_team, childBracketRow.away_team,
    childBracketRow.round
  );
  console.log(`[bracket-flow] Creado match en 'matches' para ${childBracketRow.id} (${childBracketRow.round}): ${childBracketRow.home_team} vs ${childBracketRow.away_team}`);
  return true;
}

module.exports = {
  getMatchById,
  getMatchByRoundPos,
  getChildren,
  nextRoundOf,
  getScheduleFor,
  setBracketWinner,
  maybeCreateNextRoundMatch,
  clearDownstream: clearDownstreamInternal,
  ROUND_NEXT,
  ROUND_POSITIONS,
  ROUND_LABEL,
};
