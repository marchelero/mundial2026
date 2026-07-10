const express = require('express');
const { db, generateId } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { recalcAllTotals } = require('../services/scoring');
const { flagEmoji } = require('../data/countries');
const ExcelJS = require('exceljs');

function computeTeamChampionStatus() {
  const status = {};
  const bracketMatches = db.prepare(`
    SELECT bm.round, bm.position, bm.home_team, bm.away_team, bm.winner,
           m.home_score, m.away_score, m.status as match_status
    FROM bracket_matches bm
    LEFT JOIN matches m ON bm.match_id = m.id
  `).all();

  for (const bm of bracketMatches) {
    if (bm.home_team && bm.home_team !== 'Por definir' && status[bm.home_team] !== 'eliminated') {
      status[bm.home_team] = 'alive';
    }
    if (bm.away_team && bm.away_team !== 'Por definir' && status[bm.away_team] !== 'eliminated') {
      status[bm.away_team] = 'alive';
    }
  }

  for (const bm of bracketMatches) {
    if (bm.round === 'third') continue;

    let loser = null;
    if (bm.winner === 'home') {
      loser = bm.away_team;
    } else if (bm.winner === 'away') {
      loser = bm.home_team;
    } else if (bm.match_status === 'finished' && bm.home_score != null && bm.away_score != null) {
      if (bm.home_score > bm.away_score) loser = bm.away_team;
      else if (bm.away_score > bm.home_score) loser = bm.home_team;
    }

    if (loser && loser !== 'Por definir') status[loser] = 'eliminated';
  }

  return status;
}

const router = express.Router();

router.get('/', authRequired, adminRequired, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name, google_id, is_admin, created_at, COALESCE(total_points, 0) as total_points FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (e) {
    console.error('Error listing users:', e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/', authRequired, adminRequired, (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requerido' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const id = generateId();
    const userName = (name || '').trim() || cleanEmail.split('@')[0];
    db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, NULL, ?, ?)').run(id, cleanEmail, userName);
    const user = db.prepare('SELECT id, email, name, google_id, created_at FROM users WHERE id = ?').get(id);
    res.status(201).json(user);
  } catch (e) {
    console.error('Error creating user:', e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const user = db.prepare('SELECT id, google_id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.google_id) {
      return res.status(400).json({ error: 'No se puede eliminar un usuario que ya vinculó su cuenta de Google' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

router.put('/:id', authRequired, adminRequired, (req, res) => {
  try {
    const { email, name } = req.body;
    const user = db.prepare('SELECT id, email, name, google_id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email requerido' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanEmail, user.id);
      if (existing) {
        return res.status(409).json({ error: 'El email ya está registrado por otro usuario' });
      }
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(cleanEmail, user.id);
    }

    if (name !== undefined) {
      const cleanName = (name || '').trim();
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, user.id);
    }

    const updated = db.prepare('SELECT id, email, name, google_id, created_at, COALESCE(total_points, 0) as total_points FROM users WHERE id = ?').get(user.id);
    res.json(updated);
  } catch (e) {
    console.error('Error updating user:', e);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.get('/unlinked', authRequired, adminRequired, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name FROM users WHERE google_id IS NULL ORDER BY email ASC').all();
    res.json(users);
  } catch (e) {
    console.error('Error listing unlinked users:', e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/rankings', authRequired, (req, res) => {
  try {
    // Base rankings: all users with their total_points + champion pick
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, COALESCE(u.total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines_usados,
        (SELECT COUNT(*) FROM predictions p JOIN matches m ON m.id = p.match_id
         WHERE p.user_id = u.id AND p.comodin = 1 AND m.status != 'finished') as comodines_pendientes,
        (SELECT champion FROM champion_picks WHERE user_id = u.id) as champion_pick,
        (SELECT points FROM champion_picks WHERE user_id = u.id) as champion_bonus
      FROM users u
      ORDER BY points DESC, email ASC
    `).all();

    // Potential points: predictions for unfinished matches WITH scores
    const potentials = db.prepare(`
      SELECT p.user_id,
        SUM(CASE
          WHEN p.home_score = m.home_score AND p.away_score = m.away_score
            THEN CASE WHEN p.comodin = 1 THEN 6 ELSE 3 END
          WHEN (p.home_score - p.away_score = m.home_score - m.away_score AND m.home_score - m.away_score = 0)
            OR (p.home_score - p.away_score > 0 AND m.home_score - m.away_score > 0)
            OR (p.home_score - p.away_score < 0 AND m.home_score - m.away_score < 0)
            THEN CASE WHEN p.comodin = 1 THEN 2 ELSE 1 END
          ELSE 0
        END) as pts
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
        AND m.status != 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
      GROUP BY p.user_id
    `).all();

    // Build lookup
    const potMap = {};
    for (const p of potentials) potMap[p.user_id] = p.pts || 0;

    // Champion pick status (alive / eliminated / winner)
    const teamStatus = computeTeamChampionStatus();
    const champWinnerRow = db.prepare("SELECT value FROM settings WHERE key='champion_winner'").get();
    const championWinner = (champWinnerRow && champWinnerRow.value) ? champWinnerRow.value : '';

    res.localsChampionWinner = championWinner;

    // Merge and sort by total + potential
    const result = users.map(u => {
      const pick = u.champion_pick || null;
      let championStatus = null;
      if (pick) {
        if (championWinner && pick === championWinner) {
          championStatus = 'winner';
        } else if (teamStatus[pick] === 'alive') {
          championStatus = 'alive';
        } else {
          championStatus = 'eliminated';
        }
      }
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        points: u.points,
        potential_points: potMap[u.id] || 0,
        comodin_usado: (u.comodines_usados || 0) > 0,
        comodines_usados: u.comodines_usados || 0,
        comodines_pendientes: u.comodines_pendientes || 0,
        champion_pick: pick,
        champion_status: championStatus,
        champion_flag: pick ? flagEmoji(pick) : null,
        champion_bonus: (u.champion_bonus && u.champion_bonus > 0) ? u.champion_bonus : 0,
      };
    }).sort((a, b) => {
      const diff = (b.points + b.potential_points) - (a.points + a.potential_points);
      return diff !== 0 ? diff : a.email.localeCompare(b.email);
    });

    res.json({ users: result, champion_winner: res.localsChampionWinner || '' });
  } catch (e) {
    console.error('Rankings error:', e);
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

router.post('/recalculate-totals', authRequired, adminRequired, (req, res) => {
  try {
    const result = recalcAllTotals();
    console.log('[Recalc]', result);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Recalculate totals error:', e);
    res.status(500).json({ error: 'Error al recalcular totales: ' + e.message });
  }
});

router.patch('/:id/admin', authRequired, adminRequired, (req, res) => {
  try {
    const { is_admin } = req.body;
    if (typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_admin debe ser boolean' });
    }
    const target = db.prepare('SELECT id, email, is_admin FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // No permitir degradarse a si mismo (evita lockout)
    if (target.id === req.user.id && !is_admin) {
      return res.status(400).json({ error: 'No podés degradarte a vos mismo' });
    }

    // Si va a degradar, chequear que quede al menos 1 admin
    if (!is_admin && target.is_admin) {
      const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 1').get().c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'No podés degradar al último admin' });
      }
    }

    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, target.id);
    const updated = db.prepare('SELECT id, email, name, is_admin FROM users WHERE id = ?').get(target.id);
    res.json(updated);
  } catch (e) {
    console.error('Promote/demote error:', e);
    res.status(500).json({ error: 'Error al cambiar rol' });
  }
});

const ROUND_ORDER = `CASE round
  WHEN 'group' THEN 1
  WHEN 'round_16' THEN 2
  WHEN 'round_8' THEN 3
  WHEN 'quarter' THEN 4
  WHEN 'semi' THEN 5
  WHEN 'third' THEN 6
  WHEN 'final' THEN 7
  ELSE 8
END`;

const ROUND_LABELS = {
  group: 'Fase de Grupos',
  round_16: 'Dieciseisavos',
  round_8: 'Octavos',
  quarter: 'Cuartos',
  semi: 'Semifinales',
  third: '3er Puesto',
  final: 'Final',
};

router.get('/rankings/mentions', authRequired, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, COALESCE(u.total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IN (3, 6)) as exactos,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IN (1, 2)) as resultados,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points = 0) as errors,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IS NULL) as pendientes,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id) as total_predictions,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IS NOT NULL) as finished_predictions,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1 AND points = 6) as comodin_aciertos,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND home_score = away_score) as empates,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND (home_score + away_score >= 8 OR ABS(home_score - away_score) >= 5 OR home_score >= 7 OR away_score >= 7)) as absurdos,
        (SELECT champion FROM champion_picks WHERE user_id = u.id) as champion_pick,
        (SELECT points FROM champion_picks WHERE user_id = u.id) as champion_bonus
      FROM users u
    `).all();

    // Compute longest streak of consecutive exact predictions per user
    const allPreds = db.prepare(`
      SELECT p.user_id, p.points, m.date, m.time
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE m.status = 'finished' AND p.points IS NOT NULL
      ORDER BY p.user_id, m.date, m.time
    `).all();
    const streakByUser = {};
    const wrongStreakByUser = {};
    let currentUser = null;
    let currentStreak = 0;
    let maxStreak = 0;
    let currentWrong = 0;
    let maxWrong = 0;
    for (const p of allPreds) {
      if (p.user_id !== currentUser) {
        if (currentUser) {
          streakByUser[currentUser] = maxStreak;
          wrongStreakByUser[currentUser] = maxWrong;
        }
        currentUser = p.user_id;
        currentStreak = 0;
        maxStreak = 0;
        currentWrong = 0;
        maxWrong = 0;
      }
      if (p.points === 3 || p.points === 6) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        currentWrong = 0;
      } else {
        currentStreak = 0;
        if (p.points === 0) {
          currentWrong++;
          if (currentWrong > maxWrong) maxWrong = currentWrong;
        } else {
          currentWrong = 0;
        }
      }
    }
    if (currentUser) {
      streakByUser[currentUser] = maxStreak;
      wrongStreakByUser[currentUser] = maxWrong;
    }
    for (const u of users) {
      u.streak = streakByUser[u.id] || 0;
      u.wrong_streak = wrongStreakByUser[u.id] || 0;
    }
    for (const u of users) u.streak = streakByUser[u.id] || 0;

    // Total matches for "último en pie" check
    const totalMatchesCount = db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'finished'`).get().c;

    // Hincha fiel: for each user, the team they predicted to win most often
    const winsByUserTeam = db.prepare(`
      SELECT user_id, team, COUNT(*) as c FROM (
        SELECT p.user_id, m.home_team as team
        FROM predictions p JOIN matches m ON m.id = p.match_id
        WHERE p.home_score > p.away_score
        UNION ALL
        SELECT p.user_id, m.away_team as team
        FROM predictions p JOIN matches m ON m.id = p.match_id
        WHERE p.away_score > p.home_score
      ) GROUP BY user_id, team
    `).all();
    const loyaltyMap = {};
    for (const r of winsByUserTeam) {
      if (!loyaltyMap[r.user_id] || r.c > loyaltyMap[r.user_id].c) {
        loyaltyMap[r.user_id] = { team: r.team, c: r.c };
      }
    }

    // Consensus per match: for each finished match, what did the majority predict?
    const consensusRows = db.prepare(`
      SELECT m.id, m.home_team, m.away_team,
        SUM(CASE WHEN p.home_score > p.away_score THEN 1 ELSE 0 END) as h,
        SUM(CASE WHEN p.away_score > p.home_score THEN 1 ELSE 0 END) as a,
        SUM(CASE WHEN p.home_score = p.away_score THEN 1 ELSE 0 END) as d
      FROM matches m
      LEFT JOIN predictions p ON p.match_id = m.id
      WHERE m.status = 'finished'
      GROUP BY m.id, m.home_team, m.away_team
    `).all();
    const consensusMap = {};
    for (const c of consensusRows) {
      let pick = 'h';
      if (c.d > c.h && c.d > c.a) pick = 'd';
      else if (c.a > c.h && c.a > c.d) pick = 'a';
      else if (c.h === c.a && c.h > c.d) pick = 'h';
      consensusMap[c.id] = { pick, home_team: c.home_team, away_team: c.away_team };
    }

    // For each user, count "contra corriente" picks
    const userPreds = db.prepare(`
      SELECT p.user_id, p.match_id, p.home_score, p.away_score
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE m.status = 'finished'
    `).all();
    const contraCount = {};
    for (const p of userPreds) {
      const c = consensusMap[p.match_id];
      if (!c) continue;
      let userPick = 'h';
      if (p.home_score > p.away_score) userPick = 'h';
      else if (p.away_score > p.home_score) userPick = 'a';
      else userPick = 'd';
      if (userPick !== c.pick) {
        contraCount[p.user_id] = (contraCount[p.user_id] || 0) + 1;
      }
    }

    const potentialMap = {};
    try {
      const pots = db.prepare(`
        SELECT p.user_id, SUM(CASE
          WHEN p.home_score = m.home_score AND p.away_score = m.away_score
            THEN CASE WHEN p.comodin = 1 THEN 6 ELSE 3 END
          WHEN (p.home_score - p.away_score = m.home_score - m.away_score AND m.home_score - m.away_score = 0)
            OR (p.home_score - p.away_score > 0 AND m.home_score - m.away_score > 0)
            OR (p.home_score - p.away_score < 0 AND m.home_score - m.away_score < 0)
            THEN CASE WHEN p.comodin = 1 THEN 2 ELSE 1 END
          ELSE 0
        END) as pts
        FROM predictions p
        JOIN matches m ON m.id = p.match_id
          AND m.status != 'finished'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
        GROUP BY p.user_id
      `).all();
      for (const p of pots) potentialMap[p.user_id] = p.pts || 0;
    } catch (_) {}

    for (const u of users) u.potential_points = potentialMap[u.id] || 0;

    const teamStatus = computeTeamChampionStatus();
    const champWinnerRow = db.prepare("SELECT value FROM settings WHERE key='champion_winner'").get();
    const championWinner = (champWinnerRow && champWinnerRow.value) ? champWinnerRow.value : '';
    const bracketTeams = new Set();
    const bracketMatches = db.prepare(`SELECT home_team, away_team FROM bracket_matches`).all();
    for (const bm of bracketMatches) {
      if (bm.home_team && bm.home_team !== 'Por definir') bracketTeams.add(bm.home_team);
      if (bm.away_team && bm.away_team !== 'Por definir') bracketTeams.add(bm.away_team);
    }

    const getChampionStatus = (pick) => {
      if (!pick) return null;
      if (championWinner && pick === championWinner) return 'winner';
      if (teamStatus[pick] === 'alive') return 'alive';
      if (bracketTeams.has(pick)) return 'eliminated';
      return 'no_qualify';
    };

    for (const u of users) {
      const status = getChampionStatus(u.champion_pick);
      u.champion_status_detail = status;
    }

    const findTop = (arr, key, min = 1) => {
      if (!arr.length) return [];
      const max = Math.max(...arr.map(a => a[key] || 0));
      if (max < min) return [];
      return arr.filter(a => (a[key] || 0) === max);
    };

    const findBottom = (arr, key, min = 1) => {
      if (!arr.length) return [];
      const valid = arr.filter(a => (a.finished_predictions || 0) >= min);
      if (!valid.length) return [];
      const minVal = Math.min(...valid.map(a => a[key] || 0));
      return valid.filter(a => (a[key] || 0) === minVal);
    };

    const mentions = [];

    const masAfortunado = findTop(users, 'streak', 1);
    if (masAfortunado.length) {
      const val = masAfortunado[0].streak;
      mentions.push({
        emoji: '🎰',
        title: 'Más afortunado',
        description: 'La racha más larga de aciertos exactos consecutivos',
        color: 'gold',
        users: masAfortunado.map(u => ({
          name: u.name,
          detail: `racha de ${u.streak} partido${u.streak === 1 ? '' : 's'} con acierto exacto consecutivo${u.streak === 1 ? '' : 's'}`
        }))
      });
    }

    const withFinished = users.filter(u => u.finished_predictions >= 5);
    if (withFinished.length) {
      withFinished.forEach(u => { u.exact_rate = u.finished_predictions > 0 ? (u.exactos / u.finished_predictions) : 0; });
      const francotirador = findTop(withFinished, 'exact_rate', 0.01);
      if (francotirador.length) {
        const pct = Math.round(francotirador[0].exact_rate * 100);
        mentions.push({
          emoji: '🎯',
          title: 'Francotirador',
          description: 'Mayor porcentaje de scores exactos (mín. 5 partidos)',
          color: 'red',
          users: francotirador.map(u => ({
            name: u.name,
            detail: `${pct}% de exactos (${u.exactos}/${u.finished_predictions})`
          }))
        });
      }
    }

    const reyResultado = findTop(users, 'resultados', 1);
    if (reyResultado.length) {
      const val = reyResultado[0].resultados;
      mentions.push({
        emoji: '👑',
        title: 'Rey del resultado',
        description: 'El que más veces acertó quién ganaba (sin importar el marcador)',
        color: 'yellow',
        users: reyResultado.map(u => ({
          name: u.name,
          detail: `${u.resultados} resultado${u.resultados === 1 ? '' : 's'} correcto${u.resultados === 1 ? '' : 's'}`
        }))
      });
    }

    const novato = users.filter(u => u.exactos === 1 && u.finished_predictions > 0);
    if (novato.length) {
      mentions.push({
        emoji: '🐣',
        title: 'Apostador novato',
        description: 'Solo tuvo 1 acierto exacto en todo el torneo',
        color: 'pink',
        users: novato.map(u => ({
          name: u.name,
          detail: 'solo 1 acierto exacto'
        }))
      });
    }

    const magoComodin = findTop(users, 'comodin_aciertos', 1);
    if (magoComodin.length) {
      const val = magoComodin[0].comodin_aciertos;
      mentions.push({
        emoji: '🍀',
        title: 'Mago del comodín',
        description: 'El que mejor usó el comodín para ganar +6 pts',
        color: 'green',
        users: magoComodin.map(u => ({
          name: u.name,
          detail: `${u.comodin_aciertos} acierto${u.comodin_aciertos === 1 ? '' : 's'} con comodín (+6 pts c/u)`
        }))
      });
    }

    const conservador = users
      .filter(u => u.comodines === 0 && u.finished_predictions >= 3 && u.points > 0)
      .sort((a, b) => b.points - a.points);
    if (conservador.length) {
      const val = conservador[0].points;
      mentions.push({
        emoji: '🛡️',
        title: 'El conservador',
        description: 'Mejor puntaje sin gastar ningún comodín',
        color: 'blue',
        users: conservador.filter(u => u.points === val).map(u => ({
          name: u.name,
          detail: `${u.points} pts sin gastar comodines`
        }))
      });
    }

    const peorSuerte = findBottom(users, 'points', 1);
    if (peorSuerte.length) {
      const val = peorSuerte[0].points;
      mentions.push({
        emoji: '💀',
        title: 'Mala suerte',
        description: 'El que menos puntos tiene (con al menos 1 predicción)',
        color: 'gray',
        users: peorSuerte.map(u => ({
          name: u.name,
          detail: `${u.points} pts (el más bajo del grupo)`
        }))
      });
    }

    const masActivo = findTop(users, 'total_predictions', 1);
    if (masActivo.length) {
      const val = masActivo[0].total_predictions;
      mentions.push({
        emoji: '🚀',
        title: 'El más activo',
        description: 'El que más pronósticos envió al torneo',
        color: 'purple',
        users: masActivo.map(u => ({
          name: u.name,
          detail: `${u.total_predictions} pronósticos enviado${u.total_predictions === 1 ? '' : 's'}`
        }))
      });
    }

    // 🤡 El soñador: champion pick eliminated in dieciseisavos OR didn't qualify
    const dieciseisavosLosers = db.prepare(`
      SELECT CASE WHEN winner = 'home' THEN away_team ELSE home_team END as team
      FROM bracket_matches WHERE round = 'r32' AND winner IS NOT NULL
    `).all();
    const dieciseisavosSet = new Set(dieciseisavosLosers.map(r => r.team));
    const sonador = users.filter(u => {
      if (!u.champion_pick) return false;
      if (u.champion_status_detail === 'no_qualify') return true;
      if (u.champion_status_detail === 'eliminated' && dieciseisavosSet.has(u.champion_pick)) return true;
      return false;
    });
    if (sonador.length) {
      mentions.push({
        emoji: '🤡',
        title: 'El soñador',
        description: 'Predijo campeón a un equipo que no pasó de octavos',
        color: 'pink',
        users: sonador.map(u => {
          const inKO = u.champion_status_detail === 'eliminated';
          return {
            name: u.name,
            detail: inKO
              ? `predijo a ${u.champion_pick} (cayó en dieciseisavos)`
              : `predijo a ${u.champion_pick} (ni pasó de grupos)`
          };
        })
      });
    }

    // 🎭 El iluso: champion pick that was eliminated in octavos (round_8)
    const octavosLosers = db.prepare(`
      SELECT CASE WHEN winner = 'home' THEN away_team ELSE home_team END as team
      FROM bracket_matches WHERE round = 'r16' AND winner IS NOT NULL
    `).all();
    const octavosSet = new Set(octavosLosers.map(r => r.team));
    const iluso = users.filter(u =>
      u.champion_pick &&
      u.champion_status_detail === 'eliminated' &&
      octavosSet.has(u.champion_pick)
    );
    if (iluso.length) {
      mentions.push({
        emoji: '🎭',
        title: 'El iluso',
        description: 'Predijo campeón pero su equipo no pasó ni de cuartos',
        color: 'pink',
        users: iluso.map(u => ({
          name: u.name,
          detail: `predijo a ${u.champion_pick} (cayó en octavos)`
        }))
      });
    }

    // 🐢 El último en pie: lowest points but predicted all matches
    const participantes = users.filter(u => u.total_predictions >= totalMatchesCount && totalMatchesCount > 0);
    if (participantes.length) {
      const peor = findBottom(participantes, 'points', 1);
      if (peor.length) {
        const val = peor[0].points;
        mentions.push({
          emoji: '🐢',
          title: 'El último en pie',
          description: 'El de menos puntos, pero que predijo todos los partidos',
          color: 'gray',
          users: peor.map(u => ({
            name: u.name,
            detail: `${u.points} pts pero predijo los ${u.total_predictions} partidos`
          }))
        });
      }
    }

    // 🎲 Rey del empate: most draw predictions
    const empates = findTop(users, 'empates', 1);
    if (empates.length) {
      mentions.push({
        emoji: '🎲',
        title: 'Rey del empate',
        description: 'El que más veces pronosticó un empate',
        color: 'yellow',
        users: empates.map(u => ({
          name: u.name,
          detail: `pronosticó ${u.empates} empate${u.empates === 1 ? '' : 's'}`
        }))
      });
    }

    // 🔪 Cirujano del empate: most correctly predicted draws
    const cirujanoRows = db.prepare(`
      SELECT p.user_id, COUNT(*) as c
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE m.status = 'finished'
        AND p.home_score = p.away_score
        AND m.home_score = m.away_score
      GROUP BY p.user_id
    `).all();
    const cirujanoMap = {};
    for (const r of cirujanoRows) cirujanoMap[r.user_id] = r.c;
    for (const u of users) u.cirujano = cirujanoMap[u.id] || 0;
    const cirujano = findTop(users, 'cirujano', 1);
    if (cirujano.length) {
      mentions.push({
        emoji: '🔪',
        title: 'Vivo del empate',
        description: 'El que más veces predijo empate Y fue empate',
        color: 'gray',
        users: cirujano.map(u => ({
          name: u.name,
          detail: `acertó ${u.cirujano} empate${u.cirujano === 1 ? '' : 's'} exacto${u.cirujano === 1 ? '' : 's'}`
        }))
      });
    }

    // ❤️ El hincha fiel: predicted the same team to win most often
    const lealtad = users
      .filter(u => loyaltyMap[u.id] && loyaltyMap[u.id].c >= 3)
      .sort((a, b) => loyaltyMap[b.id].c - loyaltyMap[a.id].c);
    if (lealtad.length) {
      const topC = loyaltyMap[lealtad[0].id].c;
      const winners = lealtad.filter(u => loyaltyMap[u.id].c === topC);
      mentions.push({
        emoji: '❤️',
        title: 'El hincha fiel',
        description: 'El que más lealtad mostró por un mismo equipo',
        color: 'red',
        users: winners.map(u => ({
          name: u.name,
          detail: `voto ${topC} veces por ${loyaltyMap[u.id].team}`
        }))
      });
    }

    // 🔥 El que va contra todos: most predictions against consensus
    let contraUsers = users.map(u => ({ ...u, contra: contraCount[u.id] || 0 }));
    contraUsers = contraUsers.filter(u => u.contra >= 3);
    if (contraUsers.length) {
      const topContra = Math.max(...contraUsers.map(u => u.contra));
      const winners = contraUsers.filter(u => u.contra === topContra);
      mentions.push({
        emoji: '🔥',
        title: 'El que va contra todos',
        description: 'El que más veces eligió al equipo menos votado por la mayoría',
        title: 'El que va contra todos',
        color: 'pink',
        users: winners.map(u => ({
          name: u.name,
          detail: `${u.contra} pronósticos contrarios al consenso`
        }))
      });
    }

    // 🧊 El frío: best points/predictions ratio among most active
    const maxPreds = Math.max(...users.map(u => u.total_predictions || 0));
    const activos = users.filter(u => u.total_predictions >= maxPreds * 0.8 && u.total_predictions > 0);
    if (activos.length) {
      activos.forEach(u => { u.ratio = u.points / u.total_predictions; });
      const frio = findTop(activos, 'ratio', 0.001);
      if (frio.length) {
        mentions.push({
          emoji: '🧊',
          title: 'El frío y calculador',
          description: 'Mejor ratio de puntos por pronóstico entre los más activos',
          color: 'blue',
          users: frio.map(u => ({
            name: u.name,
            detail: `ratio de ${u.ratio.toFixed(2)} pts por pronóstico (${u.points}/${u.total_predictions})`
          }))
        });
      }
    }

    // 🔋 El de batería baja: best points in first half of tournament, then faded
    const halfMatchIds = db.prepare(`
      SELECT id FROM matches WHERE status = 'finished'
      ORDER BY date ASC, time ASC
    `).all();
    const halfIdx = Math.floor(halfMatchIds.length / 2);
    const firstHalfIds = halfMatchIds.slice(0, halfIdx).map(r => r.id);
    if (firstHalfIds.length > 0) {
      const ph = firstHalfIds.map(() => '?').join(',');
      const firstHalfRows = db.prepare(`
        SELECT user_id, SUM(points) as pts FROM predictions
        WHERE match_id IN (${ph}) AND points IS NOT NULL
        GROUP BY user_id
      `).all(...firstHalfIds);
      const firstHalfMap = {};
      for (const r of firstHalfRows) firstHalfMap[r.user_id] = r.pts || 0;
      const bateriaUsers = users
        .filter(u => u.finished_predictions >= halfIdx * 0.8 && (firstHalfMap[u.id] || 0) > 0)
        .map(u => {
          const firstHalf = firstHalfMap[u.id] || 0;
          const secondHalf = (u.points || 0) - firstHalf;
          const diff = firstHalf - secondHalf;
          return { ...u, firstHalf, secondHalf, diff };
        })
        .filter(u => u.diff > 0);
      if (bateriaUsers.length) {
        bateriaUsers.sort((a, b) => b.diff - a.diff);
        const topDiff = bateriaUsers[0].diff;
        const winners = bateriaUsers.filter(u => u.diff === topDiff);
        mentions.push({
          emoji: '🔋',
          title: 'El de batería baja',
          description: 'El que mejor puntaje sacó en la primera mitad del torneo y luego se le fue la energía',
          color: 'yellow',
          users: winners.map(u => ({
            name: u.name,
            detail: `${u.firstHalf} pts en la 1ª mitad vs ${u.secondHalf} en la 2ª (diferencia: ${u.diff})`
          }))
        });
      }
    }

    // 🏆 El matemático cuántico: most absurd predictions (scores from another dimension)
    const cuantico = findTop(users, 'absurdos', 1);
    if (cuantico.length) {
      const val = cuantico[0].absurdos;
      mentions.push({
        emoji: '🏆',
        title: 'El matemático cuántico',
        description: 'Predijo marcadores de otra realidad',
        color: 'purple',
        users: cuantico.map(u => ({
          name: u.name,
          detail: `${u.absurdos} marcador${u.absurdos === 1 ? '' : 'es'} de otro universo`
        }))
      });
    }

    // 🏆 El milagro de última hora: most exact predictions in the last 10 matches
    const lastMatchIds = db.prepare(`
      SELECT id FROM matches WHERE status = 'finished'
      ORDER BY date DESC, time DESC LIMIT 10
    `).all().map(r => r.id);
    if (lastMatchIds.length > 0) {
      const placeholders = lastMatchIds.map(() => '?').join(',');
      const remontadaRows = db.prepare(`
        SELECT user_id, COUNT(*) as c
        FROM predictions
        WHERE match_id IN (${placeholders}) AND points IN (3, 6)
        GROUP BY user_id
      `).all(...lastMatchIds);
      const remontadaMap = {};
      for (const r of remontadaRows) remontadaMap[r.user_id] = r.c;
      for (const u of users) u.remontada = remontadaMap[u.id] || 0;
      const remontada = findTop(users, 'remontada', 2);
      if (remontada.length) {
        mentions.push({
          emoji: '🏆',
          title: 'El milagro de última hora',
          description: 'Remontó en los últimos partidos cuando ya nadie lo esperaba',
          color: 'gold',
          users: remontada.map(u => ({
            name: u.name,
            detail: `${u.remontada} acierto${u.remontada === 1 ? '' : 's'} exacto${u.remontada === 1 ? '' : 's'} en los últimos ${lastMatchIds.length} partidos`
          }))
        });
      }
    }

    // 🏆 Nostradamus al revés: longest streak of consecutive wrong predictions
    const nostradamus = findTop(users, 'wrong_streak', 2);
    if (nostradamus.length) {
      const val = nostradamus[0].wrong_streak;
      mentions.push({
        emoji: '🏆',
        title: 'Nostradamus al revés',
        description: 'La racha más larga de desaciertos consecutivos',
        color: 'red',
        users: nostradamus.filter(u => u.wrong_streak === val).map(u => ({
          name: u.name,
          detail: `${u.wrong_streak} partido${u.wrong_streak === 1 ? '' : 's'} errado${u.wrong_streak === 1 ? '' : 's'} consecutivo${u.wrong_streak === 1 ? '' : 's'}`
        }))
      });
    }

    // 🎩 Los que mueven los hilos: hardcoded organizers
    mentions.push({
      emoji: '🎩',
      title: 'Los que mueven los hilos',
      description: 'Gracias a ellos este torneo existe (aunque no ganan puntos)',
      color: 'gold',
      users: [
        { name: 'Juan Carlos Mamani', detail: 'Armó la app, pagó el dominio y se comió todos los bugs' },
        { name: 'Daniel Pinto', detail: 'Cargó resultados, configuró brackets y mantuvo todo vivo' },
        { name: 'Marcelo Albis', detail: 'Desarrollo y bebió mucho café' }
      ]
    });

    // 🪑 Los suplentes: hardcoded helpers
    mentions.push({
      emoji: '🪑',
      title: 'Los suplentes',
      description: 'Sin ellos, los que mueven los hilos se quedaban a medias',
      color: 'blue',
      users: [
        { name: 'Dennys Flores', detail: 'Server y las configuraciones técnicas' },
        { name: 'Johnny Yujra', detail: 'Rompió la app en busca de bugs' },
        { name: 'Andres Blanco', detail: 'Exprimió la app hasta el último bug' },
        { name: 'Jonas Maidana', detail: 'Cazó cada bug antes que apareciera' }
      ]
    });

    // Shuffle all mentions except the last 2 (Los que mueven los hilos + Los suplentes)
    if (mentions.length > 2) {
      const lastTwo = mentions.splice(-2);
      for (let i = mentions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mentions[i], mentions[j]] = [mentions[j], mentions[i]];
      }
      mentions.push(...lastTwo);
    }

    res.json(mentions);
  } catch (e) {
    console.error('Mentions error:', e);
    res.status(500).json({ error: 'Error al obtener menciones' });
  }
});

router.get('/rankings/export', authRequired, async (req, res) => {
  try {
    const matches = db.prepare(`
      SELECT * FROM matches
      ORDER BY ${ROUND_ORDER}, date ASC, time ASC
    `).all();

    const teamStatus = computeTeamChampionStatus();
    const champWinnerRow = db.prepare("SELECT value FROM settings WHERE key='champion_winner'").get();
    const championWinner = (champWinnerRow && champWinnerRow.value) ? champWinnerRow.value : '';

    const usersRaw = db.prepare(`
      SELECT u.id, u.email, u.name, COALESCE(u.total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines_usados,
        (SELECT champion FROM champion_picks WHERE user_id = u.id) as champion_pick,
        (SELECT points FROM champion_picks WHERE user_id = u.id) as champion_bonus
      FROM users u
      ORDER BY points DESC, u.email ASC
    `).all();

    const predictions = db.prepare(`
      SELECT p.user_id, p.match_id, p.home_score, p.away_score, p.comodin, p.points
      FROM predictions p
    `).all();
    const predMap = {};
    for (const p of predictions) predMap[`${p.user_id}_${p.match_id}`] = p;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mundial 2026 Polla';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Ranking', {
      views: [{ state: 'frozen', xSplit: 5, ySplit: 4 }],
    });

    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '🏆 RANKING MUNDIAL 2026';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF422006' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    sheet.getRow(1).height = 26;

    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fecha = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    subtitleCell.value = `Generado el ${fecha} — ${usersRaw.length} participantes — ${matches.length} partidos`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headers = ['NRO', 'PARTICIPANTE', 'PRONÓSTICO CAMPEÓN', 'COMODINES', 'BONO CAMPEÓN', 'TOTAL'];
    for (let i = 0; i < headers.length; i++) {
      const cell = sheet.getCell(3, i + 1);
      cell.value = headers[i];
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    }
    sheet.getRow(3).height = 28;

    const colWidths = [6, 28, 22, 11, 14, 9];
    for (let i = 0; i < colWidths.length; i++) sheet.getColumn(i + 1).width = colWidths[i];

    const matchStartCol = 7;
    const matchColWidths = [13, 13, 6, 6];
    let curCol = matchStartCol;
    for (const m of matches) {
      for (const w of matchColWidths) {
        sheet.getColumn(curCol).width = w;
        curCol++;
      }
    }

    let partidoNum = 0;
    let lastRound = null;
    curCol = matchStartCol;
    for (const m of matches) {
      if (m.round !== lastRound) {
        lastRound = m.round;
        partidoNum = 0;
      }
      partidoNum++;
      const startCol = curCol;
      const endCol = curCol + 3;
      sheet.mergeCells(3, startCol, 3, endCol);
      const cell = sheet.getCell(3, startCol);
      cell.value = `PARTIDO ${partidoNum} · ${ROUND_LABELS[m.round] || m.round}`;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const roundColor = m.round === 'group' ? 'FF0F766E'
        : m.round === 'final' ? 'FFB45309'
        : m.round === 'semi' ? 'FF7C2D12'
        : m.round === 'quarter' ? 'FF991B1B'
        : m.round === 'round_8' ? 'FF1E40AF'
        : m.round === 'round_16' ? 'FF312E81'
        : 'FF334155';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: roundColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
      curCol += 4;
    }

    let partidoN = 0;
    let prevRound = null;
    curCol = matchStartCol;
    for (const m of matches) {
      if (m.round !== prevRound) { prevRound = m.round; partidoN = 0; }
      partidoN++;
      const finishStatus = m.status === 'finished';
      const headerCells = [
        { value: `${m.home_team || 'TBD'}${finishStatus && m.home_score != null ? ` (${m.home_score})` : ''}`, bold: true },
        { value: `${m.away_team || 'TBD'}${finishStatus && m.away_score != null ? ` (${m.away_score})` : ''}`, bold: true },
        { value: 'COM', bold: true },
        { value: 'SUB', bold: true },
      ];
      for (let k = 0; k < headerCells.length; k++) {
        const c = sheet.getCell(4, curCol + k);
        c.value = headerCells[k].value;
        c.font = { name: 'Calibri', size: 8, bold: headerCells[k].bold, color: { argb: 'FF1E293B' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      }
      sheet.getRow(4).height = 30;
      curCol += 4;
    }

    let rank = 0;
    let prevPoints = null;
    let displayRank = 0;
    for (const u of usersRaw) {
      rank++;
      if (prevPoints === null || u.points !== prevPoints) {
        displayRank = rank;
        prevPoints = u.points;
      }

      const pick = u.champion_pick || '';
      const cStatus = !pick ? ''
        : (championWinner && pick === championWinner) ? '🏆👑 ' + pick
        : (teamStatus[pick] === 'alive') ? '🏆 ' + pick
        : '✗ ' + pick;

      const row = sheet.getRow(4 + rank);
      row.getCell(1).value = displayRank;
      row.getCell(2).value = u.name || u.email.split('@')[0];
      row.getCell(3).value = cStatus;
      row.getCell(4).value = u.comodines_usados || 0;
      const champBonus = (u.champion_bonus && u.champion_bonus > 0) ? u.champion_bonus : 0;
      row.getCell(5).value = champBonus;
      row.getCell(6).value = u.points;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(6).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF15803D' } };

      if (champBonus > 0) {
        row.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF422006' } };
        row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else {
        row.getCell(5).font = { name: 'Calibri', size: 10, color: { argb: 'FFCBD5E1' } };
        row.getCell(5).value = 0;
      }

      if (pick) {
        let champColor = 'FFF1F5F9';
        let champTextColor = 'FF64748B';
        if (championWinner && pick === championWinner) {
          champColor = 'FFFEF3C7';
          champTextColor = 'FF422006';
        } else if (teamStatus[pick] === 'alive') {
          champColor = 'FFFEF3C7';
          champTextColor = 'FF78350F';
        } else {
          champColor = 'FFF1F5F9';
          champTextColor = 'FF94A3B8';
        }
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: champColor } };
        row.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: champTextColor } };
      }

      let c = matchStartCol;
      for (const m of matches) {
        const pred = predMap[`${u.id}_${m.id}`];
        const homeCell = row.getCell(c);
        const awayCell = row.getCell(c + 1);
        const comCell = row.getCell(c + 2);
        const subCell = row.getCell(c + 3);

        homeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        awayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        comCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (pred) {
          homeCell.value = pred.home_score == null ? '' : pred.home_score;
          awayCell.value = pred.away_score == null ? '' : pred.away_score;
          comCell.value = pred.comodin ? '🍀' : '';
          const pts = pred.points || 0;
          subCell.value = pts;
          subCell.font = { name: 'Calibri', size: 9, bold: true };

          if (m.status === 'finished' && pred.home_score != null && pred.away_score != null) {
            let cellColor = null;
            if (pts >= 3) cellColor = pred.comodin ? 'FF15803D' : 'FF86EFAC';
            else if (pts >= 1) cellColor = pred.comodin ? 'FFCA8A04' : 'FFFEF08A';
            else cellColor = 'FFFECACA';

            if (cellColor) {
              const cellFontColor = pts > 0 && pred.comodin ? 'FFFFFFFF' : 'FF0F172A';
              homeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
              awayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
              homeCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: cellFontColor } };
              awayCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: cellFontColor } };
              subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
              subCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: cellFontColor } };
            }
          } else {
            homeCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
            awayCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
          }
        } else {
          subCell.value = 0;
          subCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF94A3B8' } };
          homeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          awayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          if (m.status === 'finished') {
            subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
            subCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF991B1B' } };
          }
        }

        const borderStyle = { style: 'hair', color: { argb: 'FFE2E8F0' } };
        homeCell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        awayCell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        comCell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        subCell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

        c += 4;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ranking_mundial2026_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('Export rankings error:', e);
    res.status(500).json({ error: 'Error al exportar: ' + e.message });
  }
});

module.exports = router;
