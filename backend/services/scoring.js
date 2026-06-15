const { db } = require('../db');

function calcPointsForPred(predHome, predAway, actualHome, actualAway, comodin) {
  if (actualHome == null || actualAway == null) return null;
  let pts = 0;
  if (predHome === actualHome && predAway === actualAway) {
    pts = 3;
  } else {
    const pd = predHome - predAway;
    const rd = actualHome - actualAway;
    if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) {
      pts = 1;
    }
  }
  return comodin ? pts * 2 : pts;
}

function recalcUserTotal(userId) {
  const predPts = db.prepare(
    'SELECT COALESCE(SUM(points), 0) as total FROM predictions WHERE user_id = ? AND points IS NOT NULL'
  ).get(userId);
  let champPts = 0;
  try {
    const cp = db.prepare(
      'SELECT COALESCE(points, 0) as total FROM champion_picks WHERE user_id = ? AND points IS NOT NULL'
    ).get(userId);
    if (cp) champPts = cp.total;
  } catch (_) { /* champion_picks.points column may not exist in very old DBs */ }
  const total = (predPts?.total || 0) + champPts;
  db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(total, userId);
  return total;
}

function recalcAndSavePointsForMatch(matchId) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return { affectedUsers: [], predictionsUpdated: 0 };
  if (match.home_score == null || match.away_score == null) {
    return { affectedUsers: [], predictionsUpdated: 0, skipped: 'no_score' };
  }

  const predictions = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(matchId);
  let updated = 0;
  for (const pred of predictions) {
    const pts = calcPointsForPred(
      pred.home_score, pred.away_score,
      match.home_score, match.away_score,
      !!pred.comodin
    );
    db.prepare('UPDATE predictions SET points = ? WHERE id = ?').run(pts, pred.id);
    updated++;
  }

  const userIds = [...new Set(predictions.map(p => p.user_id))];
  for (const userId of userIds) {
    recalcUserTotal(userId);
  }
  return { affectedUsers: userIds, predictionsUpdated: updated };
}

function recalcAllTotals() {
  const finished = db.prepare("SELECT id FROM matches WHERE status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL").all();
  let totalPreds = 0;
  const userIds = new Set();
  for (const m of finished) {
    const result = recalcAndSavePointsForMatch(m.id);
    totalPreds += result.predictionsUpdated;
    result.affectedUsers.forEach(id => userIds.add(id));
  }
  for (const u of db.prepare('SELECT id FROM users').all()) {
    recalcUserTotal(u.id);
  }
  return {
    matchesProcessed: finished.length,
    predictionsUpdated: totalPreds,
    usersRecalculated: userIds.size,
  };
}

module.exports = {
  calcPointsForPred,
  recalcUserTotal,
  recalcAndSavePointsForMatch,
  recalcAllTotals,
};
