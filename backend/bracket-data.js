// Official FIFA 2026 World Cup knockout bracket — chronological calendar order.
// All times in Hora Oficial de Bolivia (BOT, GMT-4).
// Each entry: { id, home, away, thirdPool, date, time }
// - thirdPool: ordered priority list of allowed 3rd place groups (null if not a 1st-vs-3rd match)
// - The ID follows dieciseisavos_01..dieciseisavos_16 in playing order

// Paramétrica: el identificador user-facing de la ronda de dieciseisavos.
// Es el valor que se guarda en `matches.round` (lo que ven los usuarios
// en predicciones y filtros). Cambiar acá si en el futuro la ronda pasara
// a llamarse distinto.
// NOTA: la `bracket.round` interna sigue siendo 'r32' (clave de ROUND_DEFINITIONS
// en el route y usada por el frontend para filtrar/secciones/CSS).
const BRACKET_ROUND = 'dieciseisavos';
const BRACKET_INTERNAL_KEY = 'r32';
const R32_PAIRINGS = [
  // ───── DOMINGO 28 DE JUNIO (1 partido) ─────
  { id: 'dieciseisavos_01', home: '2A', away: '2B', date: '2026-06-28', time: '15:00' },

  // ───── LUNES 29 DE JUNIO (3 partidos) ─────
  { id: 'dieciseisavos_02', home: '1C', away: '2F', date: '2026-06-29', time: '13:00' },
  { id: 'dieciseisavos_03', home: '1E', away: null, thirdPool: ['A', 'B', 'C', 'D', 'F'], date: '2026-06-29', time: '16:30' },
  { id: 'dieciseisavos_04', home: '1F', away: '2C', date: '2026-06-29', time: '21:00' },

  // ───── MARTES 30 DE JUNIO (3 partidos) ─────
  { id: 'dieciseisavos_05', home: '2E', away: '2I', date: '2026-06-30', time: '13:00' },
  { id: 'dieciseisavos_06', home: '1I', away: null, thirdPool: ['C', 'D', 'F', 'G', 'H'], date: '2026-06-30', time: '17:00' },
  { id: 'dieciseisavos_07', home: '1A', away: null, thirdPool: ['C', 'E', 'F', 'H', 'I'], date: '2026-06-30', time: '21:00' },

  // ───── MIÉRCOLES 1 DE JULIO (3 partidos) ─────
  { id: 'dieciseisavos_08', home: '1L', away: null, thirdPool: ['E', 'H', 'I', 'J', 'K'], date: '2026-07-01', time: '12:00' },
  { id: 'dieciseisavos_09', home: '1G', away: null, thirdPool: ['A', 'E', 'H', 'I', 'J'], date: '2026-07-01', time: '16:00' },
  { id: 'dieciseisavos_10', home: '1D', away: null, thirdPool: ['B', 'E', 'F', 'I', 'J'], date: '2026-07-01', time: '20:00' },

  // ───── JUEVES 2 DE JULIO (3 partidos) ─────
  { id: 'dieciseisavos_11', home: '1H', away: '2J', date: '2026-07-02', time: '12:00' },
  { id: 'dieciseisavos_12', home: '2K', away: '2L', date: '2026-07-02', time: '16:00' },
  { id: 'dieciseisavos_13', home: '1B', away: null, thirdPool: ['E', 'F', 'G', 'I', 'J'], date: '2026-07-02', time: '20:00' },

  // ───── VIERNES 3 DE JULIO (3 partidos) ─────
  { id: 'dieciseisavos_14', home: '2D', away: '2G', date: '2026-07-03', time: '14:00' },
  { id: 'dieciseisavos_15', home: '1J', away: '2H', date: '2026-07-03', time: '18:00' },
  { id: 'dieciseisavos_16', home: '1K', away: null, thirdPool: ['D', 'E', 'I', 'J', 'L'], date: '2026-07-03', time: '21:30' },
];

const NEXT_ROUND_SCHEDULE = {
  r16: [
    { date: '2026-07-04', time: '12:00' }, { date: '2026-07-04', time: '16:00' },
    { date: '2026-07-05', time: '12:00' }, { date: '2026-07-05', time: '16:00' },
    { date: '2026-07-06', time: '12:00' }, { date: '2026-07-06', time: '16:00' },
    { date: '2026-07-07', time: '12:00' }, { date: '2026-07-07', time: '16:00' },
  ],
  qf: [
    { date: '2026-07-11', time: '12:00' }, { date: '2026-07-11', time: '16:00' },
    { date: '2026-07-12', time: '12:00' }, { date: '2026-07-12', time: '16:00' },
  ],
  sf: [
    { date: '2026-07-14', time: '15:00' }, { date: '2026-07-15', time: '15:00' },
  ],
  third: [
    { date: '2026-07-18', time: '15:00' },
  ],
  final: [
    { date: '2026-07-19', time: '15:00' },
  ],
};

module.exports = { R32_PAIRINGS, NEXT_ROUND_SCHEDULE, BRACKET_ROUND, BRACKET_INTERNAL_KEY };
