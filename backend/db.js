const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'mundial2026.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(15);
  let result = '';
  for (let i = 0; i < 15; i++) result += chars[bytes[i] % chars.length];
  return result;
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      round TEXT DEFAULT 'group'
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      comodin INTEGER DEFAULT 0,
      UNIQUE(user_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS champion_picks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      champion TEXT NOT NULL,
      points INTEGER DEFAULT NULL,
      UNIQUE(user_id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date, time);
    CREATE INDEX IF NOT EXISTS idx_champion_picks_user ON champion_picks(user_id);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
  `);

  // Migration: make google_id nullable (pre-2026-06-12 schema)
  const usersInfo = db.prepare("PRAGMA table_info('users')").all();
  const googleIdCol = usersInfo.find(c => c.name === 'google_id');
  if (googleIdCol && googleIdCol.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    const hasTotalPts = usersInfo.find(c => c.name === 'total_points');
    db.exec(`
      CREATE TABLE users_v2 (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_points INTEGER DEFAULT 0
      );
      INSERT INTO users_v2 (id, google_id, email, name, created_at${hasTotalPts ? ', total_points' : ''})
        SELECT id, google_id, email, name, created_at${hasTotalPts ? ', total_points' : ''} FROM users;
      DROP TABLE users;
      ALTER TABLE users_v2 RENAME TO users;
    `);
    db.pragma('foreign_keys = ON');
    console.log('Migrated users table: google_id is now nullable');
  }

  // Migrations for points columns
  const hasPoints = db.prepare("SELECT name FROM pragma_table_info('predictions') WHERE name = 'points'").get();
  if (!hasPoints) {
    db.exec("ALTER TABLE predictions ADD COLUMN points INTEGER DEFAULT NULL");
  }
  const hasTotalPoints = db.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'total_points'").get();
  if (!hasTotalPoints) {
    db.exec("ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0");
  }

  const hasChampPoints = db.prepare("SELECT name FROM pragma_table_info('champion_picks') WHERE name = 'points'").get();
  if (!hasChampPoints) {
    db.exec("ALTER TABLE champion_picks ADD COLUMN points INTEGER DEFAULT NULL");
  }

  console.log('Database initialized');
} catch (e) {
  console.error('Database error:', e.message);
  process.exit(1);
}

module.exports = { db, generateId };
