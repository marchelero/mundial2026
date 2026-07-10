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

    res.json(result);
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

router.get('/rankings/export', authRequired, adminRequired, async (req, res) => {
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
