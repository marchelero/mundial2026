const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { nowStr } = require('../utils/datetime');


const FLAG_MAP = {
  'Canadá': '🇨🇦', 'México': '🇲🇽', 'Estados Unidos': '🇺🇸',
  'Australia': '🇦🇺', 'Irak': '🇮🇶', 'Irán': '🇮🇷', 'Japón': '🇯🇵', 'Jordania': '🇯🇴',
  'Corea del Sur': '🇰🇷', 'Catar': '🇶🇦', 'Arabia Saudita': '🇸🇦', 'Uzbekistán': '🇺🇿',
  'Argelia': '🇩🇿', 'Cabo Verde': '🇨🇻', 'Congo DR': '🇨🇩', 'Costa de Marfil': '🇨🇮',
  'Egipto': '🇪🇬', 'Ghana': '🇬🇭', 'Marruecos': '🇲🇦', 'Senegal': '🇸🇳',
  'Sudáfrica': '🇿🇦', 'Túnez': '🇹🇳',
  'Curazao': '🇨🇼', 'Haití': '🇭🇹', 'Panamá': '🇵🇦',
  'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨',
  'Paraguay': '🇵🇾', 'Uruguay': '🇺🇾',
  'Nueva Zelanda': '🇳🇿',
  'Alemania': '🇩🇪', 'Austria': '🇦🇹', 'Bélgica': '🇧🇪', 'Bosnia y Herzegovina': '🇧🇦',
  'Croacia': '🇭🇷', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'España': '🇪🇸', 'Francia': '🇫🇷',
  'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Italia': '🇮🇹', 'Noruega': '🇳🇴', 'Países Bajos': '🇳🇱',
  'Portugal': '🇵🇹', 'República Checa': '🇨🇿', 'Suecia': '🇸🇪', 'Suiza': '🇨🇭', 'Turquía': '🇹🇷',
};

function flagFor(teamName) {
  return FLAG_MAP[teamName] || '🏴';
}

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes' }
});

router.get('/landing-data', publicLimiter, (req, res) => {
  try {
    const stats = {
      participantes: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      partidos: db.prepare('SELECT COUNT(*) as c FROM matches').get().c,
      jugados: db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'finished'`).get().c,
    };

    const proximoRow = db.prepare(`
      SELECT id, date, time, home_team, away_team FROM matches
      WHERE status = 'open' AND (date || ' ' || time) >= ?
      ORDER BY date ASC, time ASC LIMIT 1
    `).get(nowStr());

    stats.proximo = proximoRow ? {
      date: proximoRow.date,
      time: proximoRow.time,
      home_team: proximoRow.home_team,
      away_team: proximoRow.away_team,
      home_flag: flagFor(proximoRow.home_team),
      away_flag: flagFor(proximoRow.away_team),
    } : null;

    const rankingsRaw = db.prepare(`
      SELECT id, name, COALESCE(total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND comodin = 1) as comodines_usados
      FROM users u
      ORDER BY points DESC, name ASC
    `).all();

    const rankings = rankingsRaw.map(r => ({
      id: r.id,
      name: r.name,
      points: r.points,
      comodines_usados: r.comodines_usados || 0,
    }));

    const finishedMatches = db.prepare(`
      SELECT id, date, time, home_team, away_team, home_score, away_score, round
      FROM matches WHERE status = 'finished'
      ORDER BY date ASC, time ASC
    `).all().map(m => ({
      ...m,
      home_flag: flagFor(m.home_team),
      away_flag: flagFor(m.away_team),
    }));

    const predictions = db.prepare(`
      SELECT match_id, user_id, home_score, away_score, points, comodin
      FROM predictions
      WHERE match_id IN (SELECT id FROM matches WHERE status = 'finished')
    `).all();

    res.json({ stats, rankings, finishedMatches, predictions });
  } catch (e) {
    console.error('[public/landing-data]', e);
    res.status(500).json({ error: 'No se pudo cargar la landing' });
  }
});

router.get('/champion-winner', publicLimiter, (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='champion_winner'").get();
    res.json({ champion_winner: (row && row.value) ? row.value : '' });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener campeón' });
  }
});

router.get('/mentions', publicLimiter, (req, res) => {
  try {
    const { flagEmoji } = require('../data/countries');
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, COALESCE(u.total_points, 0) as points,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IN (3, 6)) as exactos,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points IN (1, 2)) as resultados,
        (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND points = 0) as errors,
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

    const allPreds = db.prepare(`
      SELECT p.user_id, p.points, m.date, m.time
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
      WHERE m.status = 'finished' AND p.points IS NOT NULL
      ORDER BY p.user_id, m.date, m.time
    `).all();
    const streakByUser = {};
    const wrongStreakByUser = {};
    let currentUser = null, currentStreak = 0, maxStreak = 0, currentWrong = 0, maxWrong = 0;
    for (const p of allPreds) {
      if (p.user_id !== currentUser) {
        if (currentUser) {
          streakByUser[currentUser] = maxStreak;
          wrongStreakByUser[currentUser] = maxWrong;
        }
        currentUser = p.user_id;
        currentStreak = 0; maxStreak = 0;
        currentWrong = 0; maxWrong = 0;
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

    const totalMatchesCount = db.prepare(`SELECT COUNT(*) as c FROM matches WHERE status = 'finished'`).get().c;

    const winsByUserTeam = db.prepare(`
      SELECT user_id, team, COUNT(*) as c FROM (
        SELECT p.user_id, m.home_team as team FROM predictions p JOIN matches m ON m.id = p.match_id WHERE p.home_score > p.away_score
        UNION ALL
        SELECT p.user_id, m.away_team as team FROM predictions p JOIN matches m ON m.id = p.match_id WHERE p.away_score > p.home_score
      ) GROUP BY user_id, team
    `).all();
    const loyaltyMap = {};
    for (const r of winsByUserTeam) {
      if (!loyaltyMap[r.user_id] || r.c > loyaltyMap[r.user_id].c) {
        loyaltyMap[r.user_id] = { team: r.team, c: r.c };
      }
    }

    const consensusRows = db.prepare(`
      SELECT m.id, m.home_team, m.away_team,
        SUM(CASE WHEN p.home_score > p.away_score THEN 1 ELSE 0 END) as h,
        SUM(CASE WHEN p.away_score > p.home_score THEN 1 ELSE 0 END) as a,
        SUM(CASE WHEN p.home_score = p.away_score THEN 1 ELSE 0 END) as d
      FROM matches m LEFT JOIN predictions p ON p.match_id = m.id
      WHERE m.status = 'finished' GROUP BY m.id, m.home_team, m.away_team
    `).all();
    const consensusMap = {};
    for (const c of consensusRows) {
      let pick = 'h';
      if (c.d > c.h && c.d > c.a) pick = 'd';
      else if (c.a > c.h && c.a > c.d) pick = 'a';
      else if (c.h === c.a && c.h > c.d) pick = 'h';
      consensusMap[c.id] = { pick, home_team: c.home_team, away_team: c.away_team };
    }
    const userPreds = db.prepare(`
      SELECT p.user_id, p.match_id, p.home_score, p.away_score
      FROM predictions p JOIN matches m ON m.id = p.match_id
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

    function findTop(arr, key, min) {
      if (!arr.length) return [];
      const max = Math.max(...arr.map(a => a[key] || 0));
      if (max < min) return [];
      return arr.filter(a => (a[key] || 0) === max);
    }
    function findBottom(arr, key, min) {
      if (!arr.length) return [];
      const valid = arr.filter(a => (a.finished_predictions || 0) >= min);
      if (!valid.length) return [];
      const minVal = Math.min(...valid.map(a => a[key] || 0));
      return valid.filter(a => (a[key] || 0) === minVal);
    }

    const mentions = [];

    const masAfortunado = findTop(users, 'streak', 1);
    if (masAfortunado.length) {
      mentions.push({
        emoji: '🎰', title: 'Más afortunado', description: 'La racha más larga de aciertos exactos consecutivos', color: 'gold',
        users: masAfortunado.map(u => ({ name: u.name, detail: 'racha de ' + u.streak + ' partido' + (u.streak === 1 ? '' : 's') + ' con acierto exacto consecutivo' + (u.streak === 1 ? '' : 's') }))
      });
    }
    const withFinished = users.filter(u => u.finished_predictions >= 5);
    if (withFinished.length) {
      withFinished.forEach(u => { u.exact_rate = u.finished_predictions > 0 ? (u.exactos / u.finished_predictions) : 0; });
      const francotirador = findTop(withFinished, 'exact_rate', 0.01);
      if (francotirador.length) {
        const pct = Math.round(francotirador[0].exact_rate * 100);
        mentions.push({
          emoji: '🎯', title: 'Francotirador', description: 'Mayor porcentaje de scores exactos (mín. 5 partidos)', color: 'red',
          users: francotirador.map(u => ({ name: u.name, detail: pct + '% de exactos (' + u.exactos + '/' + u.finished_predictions + ')' }))
        });
      }
    }
    const reyResultado = findTop(users, 'resultados', 1);
    if (reyResultado.length) {
      mentions.push({
        emoji: '👑', title: 'Rey del resultado', description: 'El que más veces acertó quién ganaba (sin importar el marcador)', color: 'yellow',
        users: reyResultado.map(u => ({ name: u.name, detail: u.resultados + ' resultado' + (u.resultados === 1 ? '' : 's') + ' correcto' + (u.resultados === 1 ? '' : 's') }))
      });
    }
    const novato = users.filter(u => u.exactos === 1 && u.finished_predictions > 0);
    if (novato.length) {
      mentions.push({
        emoji: '🐣', title: 'Apostador novato', description: 'Solo tuvo 1 acierto exacto en todo el torneo', color: 'pink',
        users: novato.map(u => ({ name: u.name, detail: 'solo 1 acierto exacto' }))
      });
    }
    const magoComodin = findTop(users, 'comodin_aciertos', 1);
    if (magoComodin.length) {
      mentions.push({
        emoji: '🍀', title: 'Mago del comodín', description: 'El que mejor usó el comodín para ganar +6 pts', color: 'green',
        users: magoComodin.map(u => ({ name: u.name, detail: u.comodin_aciertos + ' acierto' + (u.comodin_aciertos === 1 ? '' : 's') + ' con comodín (+6 pts c/u)' }))
      });
    }
    const conservador = users.filter(u => u.comodines === 0 && u.finished_predictions >= 3 && u.points > 0).sort((a, b) => b.points - a.points);
    if (conservador.length) {
      const val = conservador[0].points;
      mentions.push({
        emoji: '🛡️', title: 'El conservador', description: 'Mejor puntaje sin gastar ningún comodín', color: 'blue',
        users: conservador.filter(u => u.points === val).map(u => ({ name: u.name, detail: u.points + ' pts sin gastar comodines' }))
      });
    }
    const peorSuerte = findBottom(users, 'points', 1);
    if (peorSuerte.length) {
      mentions.push({
        emoji: '💀', title: 'Mala suerte', description: 'El que menos puntos tiene (con al menos 1 predicción)', color: 'gray',
        users: peorSuerte.map(u => ({ name: u.name, detail: u.points + ' pts (el más bajo del grupo)' }))
      });
    }
    const masActivo = findTop(users, 'total_predictions', 1);
    if (masActivo.length) {
      mentions.push({
        emoji: '🚀', title: 'El más activo', description: 'El que más pronósticos envió al torneo', color: 'purple',
        users: masActivo.map(u => ({ name: u.name, detail: u.total_predictions + ' pronósticos enviado' + (u.total_predictions === 1 ? '' : 's') }))
      });
    }

    const participantes = users.filter(u => u.total_predictions >= totalMatchesCount && totalMatchesCount > 0);
    if (participantes.length) {
      const peor = findBottom(participantes, 'points', 1);
      if (peor.length) {
        mentions.push({
          emoji: '🐢', title: 'El último en pie', description: 'El de menos puntos, pero que predijo todos los partidos', color: 'gray',
          users: peor.map(u => ({ name: u.name, detail: u.points + ' pts pero predijo los ' + u.total_predictions + ' partidos' }))
        });
      }
    }
    const empates = findTop(users, 'empates', 1);
    if (empates.length) {
      mentions.push({
        emoji: '🎲', title: 'Rey del empate', description: 'El que más veces pronosticó un empate', color: 'yellow',
        users: empates.map(u => ({ name: u.name, detail: 'pronosticó ' + u.empates + ' empate' + (u.empates === 1 ? '' : 's') }))
      });
    }
    const cuanticoRows = db.prepare(`SELECT p.user_id, COUNT(*) as c FROM predictions p JOIN matches m ON m.id = p.match_id WHERE m.status = 'finished' AND p.home_score = p.away_score AND m.home_score = m.away_score GROUP BY p.user_id`).all();
    const cirujanoMap = {};
    for (const r of cuanticoRows) cirujanoMap[r.user_id] = r.c;
    for (const u of users) u.cirujano = cirujanoMap[u.id] || 0;
    const cirujano = findTop(users, 'cirujano', 1);
    if (cirujano.length) {
      mentions.push({
        emoji: '🔪', title: 'Cirujano del empate', description: 'El que más veces predijo empate Y fue empate', color: 'gray',
        users: cirujano.map(u => ({ name: u.name, detail: 'acertó ' + u.cirujano + ' empate' + (u.cirujano === 1 ? '' : 's') + ' exacto' + (u.cirujano === 1 ? '' : 's') }))
      });
    }
    const lealtad = users.filter(u => loyaltyMap[u.id] && loyaltyMap[u.id].c >= 3).sort((a, b) => loyaltyMap[b.id].c - loyaltyMap[a.id].c);
    if (lealtad.length) {
      const topC = loyaltyMap[lealtad[0].id].c;
      const winners = lealtad.filter(u => loyaltyMap[u.id].c === topC);
      mentions.push({
        emoji: '❤️', title: 'El hincha fiel', description: 'El que más lealtad mostró por un mismo equipo', color: 'red',
        users: winners.map(u => ({ name: u.name, detail: 'voto ' + topC + ' veces por ' + loyaltyMap[u.id].team }))
      });
    }
    let contraUsers = users.map(u => ({ ...u, contra: contraCount[u.id] || 0 }));
    contraUsers = contraUsers.filter(u => u.contra >= 3);
    if (contraUsers.length) {
      const topContra = Math.max(...contraUsers.map(u => u.contra));
      const winners = contraUsers.filter(u => u.contra === topContra);
      mentions.push({
        emoji: '🔥', title: 'El que va contra todos', description: 'El que más veces eligió al equipo menos votado por la mayoría', color: 'pink',
        users: winners.map(u => ({ name: u.name, detail: u.contra + ' pronósticos contrarios al consenso' }))
      });
    }
    const maxPreds = Math.max(...users.map(u => u.total_predictions || 0));
    const activos = users.filter(u => u.total_predictions >= maxPreds * 0.8 && u.total_predictions > 0);
    if (activos.length) {
      activos.forEach(u => { u.ratio = u.points / u.total_predictions; });
      const frio = findTop(activos, 'ratio', 0.001);
      if (frio.length) {
        mentions.push({
          emoji: '🧊', title: 'El frío y calculador', description: 'Mejor ratio de puntos por pronóstico entre los más activos', color: 'blue',
          users: frio.map(u => ({ name: u.name, detail: 'ratio de ' + u.ratio.toFixed(2) + ' pts por pronóstico (' + u.points + '/' + u.total_predictions + ')' }))
        });
      }
    }
    const halfMatchIds = db.prepare(`SELECT id FROM matches WHERE status = 'finished' ORDER BY date ASC, time ASC`).all();
    const halfIdx = Math.floor(halfMatchIds.length / 2);
    const firstHalfIds = halfMatchIds.slice(0, halfIdx).map(r => r.id);
    if (firstHalfIds.length > 0) {
      const ph = firstHalfIds.map(() => '?').join(',');
      const firstHalfRows = db.prepare(`SELECT user_id, SUM(points) as pts FROM predictions WHERE match_id IN (${ph}) AND points IS NOT NULL GROUP BY user_id`).all(...firstHalfIds);
      const firstHalfMap = {};
      for (const r of firstHalfRows) firstHalfMap[r.user_id] = r.pts || 0;
      const bateriaUsers = users.filter(u => u.finished_predictions >= halfIdx * 0.8 && (firstHalfMap[u.id] || 0) > 0)
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
          emoji: '🔋', title: 'El de batería baja', description: 'El que mejor puntaje sacó en la primera mitad del torneo y luego se le fue la energía', color: 'yellow',
          users: winners.map(u => ({ name: u.name, detail: u.firstHalf + ' pts en la 1ª mitad vs ' + u.secondHalf + ' en la 2ª (diferencia: ' + u.diff + ')' }))
        });
      }
    }
    const cuantico = findTop(users, 'absurdos', 1);
    if (cuantico.length) {
      mentions.push({
        emoji: '🏆', title: 'El matemático cuántico', description: 'Predijo marcadores de otra realidad', color: 'purple',
        users: cuantico.map(u => ({ name: u.name, detail: u.absurdos + ' marcador' + (u.absurdos === 1 ? '' : 'es') + ' de otro universo' }))
      });
    }
    const lastMatchIds = db.prepare(`SELECT id FROM matches WHERE status = 'finished' ORDER BY date DESC, time DESC LIMIT 10`).all().map(r => r.id);
    if (lastMatchIds.length > 0) {
      const placeholders = lastMatchIds.map(() => '?').join(',');
      const remontadaRows = db.prepare(`SELECT user_id, COUNT(*) as c FROM predictions WHERE match_id IN (${placeholders}) AND points IN (3, 6) GROUP BY user_id`).all(...lastMatchIds);
      const remontadaMap = {};
      for (const r of remontadaRows) remontadaMap[r.user_id] = r.c;
      for (const u of users) u.remontada = remontadaMap[u.id] || 0;
      const remontada = findTop(users, 'remontada', 2);
      if (remontada.length) {
        mentions.push({
          emoji: '🏆', title: 'El milagro de última hora', description: 'Remontó en los últimos partidos cuando ya nadie lo esperaba', color: 'gold',
          users: remontada.map(u => ({ name: u.name, detail: u.remontada + ' acierto' + (u.remontada === 1 ? '' : 's') + ' exacto' + (u.remontada === 1 ? '' : 's') + ' en los últimos ' + lastMatchIds.length + ' partidos' }))
        });
      }
    }
    const nostradamus = findTop(users, 'wrong_streak', 2);
    if (nostradamus.length) {
      const val = nostradamus[0].wrong_streak;
      mentions.push({
        emoji: '🏆', title: 'Nostradamus al revés', description: 'La racha más larga de desaciertos consecutivos', color: 'red',
        users: nostradamus.filter(u => u.wrong_streak === val).map(u => ({ name: u.name, detail: u.wrong_streak + ' partido' + (u.wrong_streak === 1 ? '' : 's') + ' errado' + (u.wrong_streak === 1 ? '' : 's') + ' consecutivo' + (u.wrong_streak === 1 ? '' : 's') }))
      });
    }
    const dieciseisavosLosers = db.prepare(`SELECT CASE WHEN winner = 'home' THEN away_team ELSE home_team END as team FROM bracket_matches WHERE round = 'r32' AND winner IS NOT NULL`).all();
    const octavosLosers = db.prepare(`SELECT CASE WHEN winner = 'home' THEN away_team ELSE home_team END as team FROM bracket_matches WHERE round = 'r16' AND winner IS NOT NULL`).all();
    const dieciseisavosSet = new Set(dieciseisavosLosers.map(r => r.team));
    const octavosSet = new Set(octavosLosers.map(r => r.team));
    const sonador = users.filter(u => {
      if (!u.champion_pick) return false;
      return u.champion_pick && (u.champion_pick) && (octavosSet.has(u.champion_pick) || dieciseisavosSet.has(u.champion_pick));
    });
    if (sonador.length) {
      mentions.push({
        emoji: '🤡', title: 'El soñador', description: 'Predijo campeón a un equipo que no pasó de octavos', color: 'pink',
        users: sonador.map(u => {
          const inKO = octavosSet.has(u.champion_pick);
          return { name: u.name, detail: 'predijo a ' + u.champion_pick + ' (' + (inKO ? 'cayó en octavos' : 'cayó en dieciseisavos') + ')' };
        })
      });
    }
    const iluso = users.filter(u => u.champion_pick && u.champion_pick && octavosSet.has(u.champion_pick));
    if (iluso.length) {
      mentions.push({
        emoji: '🎭', title: 'El iluso', description: 'Predijo campeón pero su equipo no pasó ni de cuartos', color: 'pink',
        users: iluso.map(u => ({ name: u.name, detail: 'predijo a ' + u.champion_pick + ' (cayó en octavos)' }))
      });
    }

    mentions.push({
      emoji: '🎩', title: 'Los que mueven los hilos', description: 'Gracias a ellos este torneo existe (aunque no ganan puntos)', color: 'gold',
      users: [
        { name: 'Juan Carlos Mamani', detail: 'Armó la app, pagó el dominio y se comió todos los bugs' },
        { name: 'Daniel Pinto', detail: 'Cargó resultados, configuró brackets y mantuvo todo vivo' },
        { name: 'Marcelo Albis', detail: 'Desarrollo y bebió mucho café' }
      ]
    });
    mentions.push({
      emoji: '🪑', title: 'Los suplentes', description: 'Sin ellos, los que mueven los hilos se quedaban a medias', color: 'blue',
      users: [
        { name: 'Dennys Flores', detail: 'Server y las configuraciones técnicas' },
        { name: 'Johnny Yujra', detail: 'Rompió la app en busca de bugs' },
        { name: 'Andres Blanco', detail: 'Exprimió la app hasta el último bug' },
        { name: 'Jonas Maidana', detail: 'Cazó cada bug antes que apareciera' }
      ]
    });

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
    console.error('Public mentions error:', e);
    res.status(500).json({ error: 'Error al obtener menciones' });
  }
});

module.exports = router;
