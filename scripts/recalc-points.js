const { db } = require('../backend/db');

function calcPoints(pH, pA, aH, aA, comodin) {
  let pts = 0;
  if (pH === aH && pA === aA) { pts = 3; }
  else {
    const pd = pH - pA, rd = aH - aA;
    if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) { pts = 1; }
  }
  return comodin ? pts * 2 : pts;
}

console.log('\n🔄 Recalculando puntos de todos los partidos finalizados...\n');

const finished = db.prepare("SELECT * FROM matches WHERE status = 'finished'").all();
console.log(`  ${finished.length} partidos finished encontrados\n`);

const updatePredPts = db.prepare('UPDATE predictions SET points = ? WHERE id = ?');
const getUserPts = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM predictions WHERE user_id = ? AND points IS NOT NULL');
const getChampPts = db.prepare('SELECT COALESCE(points, 0) as total FROM champion_picks WHERE user_id = ? AND points IS NOT NULL');
const updateUserPts = db.prepare('UPDATE users SET total_points = ? WHERE id = ?');

const allUserIds = [];

for (const m of finished) {
  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(m.id);
  for (const p of preds) {
    const pts = calcPoints(p.home_score, p.away_score, m.home_score, m.away_score, !!p.comodin);
    updatePredPts.run(pts, p.id);
    if (!allUserIds.includes(p.user_id)) allUserIds.push(p.user_id);
  }
  console.log(`  ${m.home_team} vs ${m.away_team} (${m.home_score}-${m.away_score}): ${preds.length} predicciones recalculadas`);
}

let hasChampErr = false;
for (const userId of allUserIds) {
  const predPts = getUserPts.get(userId).total;
  let champPts = 0;
  try { const cp = getChampPts.get(userId); champPts = cp ? cp.total : 0; } catch (_) { hasChampErr = true; }
  updateUserPts.run(predPts + champPts, userId);
}

console.log(`\n  ✅ ${allUserIds.length} usuarios con total_points actualizado`);
if (hasChampErr) console.log('  ⚠️  champion_picks.points no disponible (ignorado)');
console.log('\n✅ Recalculo completado');
