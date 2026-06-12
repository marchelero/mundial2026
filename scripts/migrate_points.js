// Recalcula puntos de predicciones existentes y actualiza total_points de usuarios
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'mundial2026.db');
const db = new Database(dbPath);

// Ensure columns exist
const hasPoints = db.prepare("SELECT name FROM pragma_table_info('predictions') WHERE name = 'points'").get();
if (!hasPoints) db.exec("ALTER TABLE predictions ADD COLUMN points INTEGER DEFAULT NULL");
const hasTotalPoints = db.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'total_points'").get();
if (!hasTotalPoints) db.exec("ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0");
const hasChampPoints = db.prepare("SELECT name FROM pragma_table_info('champion_picks') WHERE name = 'points'").get();
if (!hasChampPoints) db.exec("ALTER TABLE champion_picks ADD COLUMN points INTEGER DEFAULT NULL");

function calcPointsForPred(predHome, predAway, actualHome, actualAway, comodin) {
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

const matches = db.prepare("SELECT * FROM matches WHERE status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL").all();
console.log(`Matches finished with scores: ${matches.length}`);

let predCount = 0;
for (const match of matches) {
  const predictions = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(match.id);
  for (const pred of predictions) {
    const pts = calcPointsForPred(pred.home_score, pred.away_score, match.home_score, match.away_score, !!pred.comodin);
    db.prepare('UPDATE predictions SET points = ? WHERE id = ?').run(pts, pred.id);
    predCount++;
  }
}
console.log(`Predictions updated: ${predCount}`);

const users = db.prepare('SELECT id FROM users').all();
for (const user of users) {
  const result = db.prepare("SELECT COALESCE(SUM(points), 0) as total FROM predictions WHERE user_id = ? AND points IS NOT NULL").get(user.id);
  db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(result.total, user.id);
}
console.log(`Users total_points updated: ${users.length}`);

db.close();
console.log('Migration complete.');
