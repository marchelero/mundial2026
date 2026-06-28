import { flagUrl } from '../utils/helpers.js';
import { api } from '../services/api.js';

const SHORT_MONTHS = { '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic' };
const DAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${SHORT_MONTHS[m] || m}`;
}
function fmtWeekday(iso) {
  if (!iso) return '';
  const dt = new Date(iso + 'T12:00:00');
  return DAYS_ES[dt.getDay()] || '';
}

const ROUND_LABELS = {
  r32:   { eyebrow: '🚀 DIECISEISAVOS DE FINAL', meta: '28 jun – 3 jul · 16 partidos',              pill: '16avos',    pillClass: 'pill-r32',  stripe: 'stripe-r32' },
  r16:   { eyebrow: '🎯 OCTAVOS DE FINAL',      meta: '4 – 7 jul · 8 partidos',                    pill: '8vos',      pillClass: 'pill-r16',  stripe: 'stripe-r16' },
  qf:    { eyebrow: '⚡ CUARTOS DE FINAL',       meta: '11 – 12 jul · 4 partidos',                  pill: '4tos',      pillClass: 'pill-qf',   stripe: 'stripe-qf' },
  sf:    { eyebrow: '🔥 SEMIFINALES',            meta: '14 – 15 jul · 2 partidos',                  pill: 'Semifinal', pillClass: 'pill-sf',   stripe: 'stripe-sf' },
  third: { eyebrow: '🥉 PARTIDO POR EL 3.er LUGAR', meta: '18 jul · 1 partido · perdedores de semis', pill: '3.er lugar', pillClass: 'pill-third', stripe: 'stripe-third' },
  final: { eyebrow: '⭐ FINAL',                  meta: '19 jul · 1 partido · MetLife Stadium',     pill: 'Final',     pillClass: 'pill-final', stripe: 'stripe-final' },
};

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

export default {
  props: ['countries', 'isAdmin', 'settings'],
  emits: ['notify'],
  data() {
    return {
      activeRound: 'all',
      viewMode: 'list',
      bracket: { r32: [], r16: [], qf: [], sf: [], third: [], final: [] },
      loading: true,
      actionInProgress: null,
      teamEdit: { open: false, bracketId: null, slot: null, team: '', seed: null },
      winnerConfirm: { open: false, bracketId: null, winner: null, teamName: '', nextMatchInfo: '' },
    };
  },
  async mounted() {
    try {
      const saved = localStorage.getItem('mundial2026_bracket_view');
      if (saved === 'list' || saved === 'tree') this.viewMode = saved;
    } catch { /* noop */ }
    await this.loadBracket();
  },
  watch: {
    viewMode(val) {
      try { localStorage.setItem('mundial2026_bracket_view', val); } catch { /* noop */ }
    },
  },
  methods: {
    teamFlag(teamName) {
      if (!teamName) return '';
      const c = this.countries.find(x => x.name === teamName);
      return c ? flagUrl(c.flag) : '';
    },
    fmtDate,
    fmtWeekday,
    roundLabels(key) { return ROUND_LABELS[key] || {}; },
    isVisible(round) {
      return this.activeRound === 'all' || this.activeRound === round;
    },
    scrollTo(round) {
      this.activeRound = round;
      this.$nextTick(() => {
        const el = this.$refs[`section_${round}`];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    },
    async loadBracket() {
      this.loading = true;
      try {
        this.bracket = await api.get('/bracket');
      } catch (e) {
        this.bracket = { r32: [], r16: [], qf: [], sf: [], third: [], final: [] };
      }
      this.loading = false;
    },
    notify(message, type = 'success') {
      this.$emit('notify', { message, type });
    },
    async initBracket() {
      if (!confirm('¿Inicializar el bracket? Se crearán los 32 partidos con fechas del Mundial 2026.')) return;
      this.actionInProgress = 'init';
      try {
        const r = await api.post('/bracket/init', {});
        this.notify(r.message || 'Bracket inicializado', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al inicializar', 'error');
      }
      this.actionInProgress = null;
    },
    async resetBracket() {
      if (!confirm('¿Reiniciar TODO el bracket? Se borrarán los 32 partidos y todas las predicciones asociadas.')) return;
      this.actionInProgress = 'reset';
      try {
        await api.post('/bracket/reset', { force: true });
        this.notify('Bracket reiniciado (predicciones borradas)', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al reiniciar', 'error');
      }
      this.actionInProgress = null;
    },
    async autoFill() {
      if (!confirm('¿Auto-llenar los 32avos desde los clasificados de la fase de grupos?')) return;
      this.actionInProgress = 'autofill';
      try {
        const r = await api.post('/bracket/auto-fill', {});
        this.notify(`Auto-llenado: ${r.assigned} equipos asignados`, 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al auto-llenar', 'error');
      }
      this.actionInProgress = null;
    },
    openTeamEdit(bracketId, slot) {
      const bm = this.findBracketMatch(bracketId);
      if (!bm) return;
      this.teamEdit = {
        open: true,
        bracketId,
        slot,
        team: slot === 'home' ? (bm.home_team || '') : (bm.away_team || ''),
        seed: slot === 'home' ? (bm.home_seed || '') : (bm.away_seed || ''),
      };
    },
    closeTeamEdit() {
      this.teamEdit = { open: false, bracketId: null, slot: null, team: '', seed: null };
    },
    async saveTeamEdit() {
      const { bracketId, slot, team, seed } = this.teamEdit;
      if (!team || !team.trim()) {
        this.notify('Equipo requerido', 'error');
        return;
      }
      this.actionInProgress = `team-${bracketId}`;
      try {
        await api.patch(`/bracket/${encodeURIComponent(bracketId)}/team`, {
          slot,
          team: team.trim(),
          seed: seed ? parseInt(seed, 10) : null,
        });
        this.notify('Equipo actualizado', 'success');
        this.closeTeamEdit();
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al actualizar', 'error');
      }
      this.actionInProgress = null;
    },
    async setWinner(bracketId, winner) {
      this.actionInProgress = `winner-${bracketId}`;
      try {
        await api.post(`/bracket/${encodeURIComponent(bracketId)}/winner`, { winner });
        this.notify('Ganador guardado y propagado', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al guardar ganador', 'error');
      }
      this.actionInProgress = null;
    },
    openWinnerConfirm(bracketId, slot) {
      const bm = this.findBracketMatch(bracketId);
      if (!bm) return;
      const team = slot === 'home' ? bm.home_team : bm.away_team;
      if (!team) {
        this.notify('Asigná primero un equipo a este slot', 'error');
        return;
      }
      // Calcular info del siguiente partido
      let nextMatchInfo = '';
      if (bracketId.startsWith('r32_')) {
        const nextPos = Math.ceil(parseInt(bracketId.split('_')[1]) / 2);
        nextMatchInfo = `Pasará a 8vos · Partido #${nextPos}`;
      } else if (bracketId.startsWith('r16_')) {
        const nextPos = Math.ceil(parseInt(bracketId.split('_')[1]) / 2);
        nextMatchInfo = `Pasará a 4tos · Partido #${nextPos}`;
      } else if (bracketId.startsWith('qf_')) {
        const nextPos = Math.ceil(parseInt(bracketId.split('_')[1]) / 2);
        nextMatchInfo = `Pasará a Semifinal · Partido #${nextPos}`;
      } else if (bracketId.startsWith('sf_1')) {
        nextMatchInfo = 'Pasará a la FINAL';
      } else if (bracketId.startsWith('sf_2')) {
        nextMatchInfo = 'Pasará a la FINAL';
      } else if (bracketId === 'third_1') {
        nextMatchInfo = '';
      } else if (bracketId === 'final_1') {
        nextMatchInfo = '🏆 CAMPEÓN DEL MUNDIAL';
      }
      this.winnerConfirm = {
        open: true,
        bracketId,
        winner: slot,
        teamName: team,
        nextMatchInfo,
      };
    },
    closeWinnerConfirm() {
      this.winnerConfirm = { open: false, bracketId: null, winner: null, teamName: '', nextMatchInfo: '' };
    },
    async confirmWinner() {
      const { bracketId, winner } = this.winnerConfirm;
      this.closeWinnerConfirm();
      await this.setWinner(bracketId, winner);
    },
    findBracketMatch(id) {
      for (const r of ROUND_ORDER) {
        const m = this.bracket[r].find(x => x.id === id);
        if (m) return m;
      }
      return null;
    },
    hasAnyData() {
      return this.bracket.r32.length > 0 || this.bracket.r16.length > 0;
    },
    matchByRoundPosition(round, position) {
      const list = this.bracket[round] || [];
      return list.find(m => m.position === position) || null;
    },
    treeMatchClass(round) {
      return `tree-match tree-match-${round}`;
    },
    treeWinnerIcon(round) {
      if (round === 'final') return '🏆';
      if (round === 'third') return '🥉';
      return '★';
    },
    treeRoundLabel(round) {
      const map = { r32: '16avos', r16: '8vos', qf: '4tos', sf: 'Semi', third: '3.er', final: 'Final' };
      return map[round] || round;
    },
    treeMatchIdLabel(round, position) {
      if (round === 'final') return 'FINAL';
      if (round === 'third') return '3.ER LUGAR';
      return `G${position}`;
    },
    treeEmptySlots(round) {
      const map = { r32: 8, r16: 4, qf: 2, sf: 1 };
      return map[round] || 0;
    },
    isTreeLast(round, pos) {
      const map = { r32: 8, r16: 4, qf: 2, sf: 1 };
      return pos === map[round];
    },
  },
  template: `
    <div class="bracket-modern">

      <div v-if="isAdmin && settings?.bracket_admin_buttons_visible !== 'false'" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <button @click="initBracket" :disabled="actionInProgress === 'init' || hasAnyData()" class="btn-bracket-admin" :style="{padding:'0.5rem 0.8rem',background:'var(--color-dark)',color:'white',border:'none',borderRadius:'6px',fontWeight:700,fontSize:'0.7rem',cursor: hasAnyData() ? 'not-allowed' : 'pointer', opacity: hasAnyData() ? 0.5 : 1}">
          {{ actionInProgress === 'init' ? '⏳' : '🏁' }} Inicializar Bracket
        </button>
        <button @click="autoFill" :disabled="actionInProgress === 'autofill' || !hasAnyData()" class="btn-bracket-admin" :style="{padding:'0.5rem 0.8rem',background:'#0ea5e9',color:'white',border:'none',borderRadius:'6px',fontWeight:700,fontSize:'0.7rem',cursor: !hasAnyData() ? 'not-allowed' : 'pointer', opacity: !hasAnyData() ? 0.5 : 1}">
          {{ actionInProgress === 'autofill' ? '⏳' : '⚡' }} Auto-llenar desde grupos
        </button>
        <button @click="resetBracket" :disabled="actionInProgress === 'reset' || !hasAnyData()" class="btn-bracket-admin" :style="{padding:'0.5rem 0.8rem',background:'#ef4444',color:'white',border:'none',borderRadius:'6px',fontWeight:700,fontSize:'0.7rem',cursor: !hasAnyData() ? 'not-allowed' : 'pointer', opacity: !hasAnyData() ? 0.5 : 1}">
          {{ actionInProgress === 'reset' ? '⏳' : '🗑' }} Resetear
        </button>
      </div>

      <div v-if="!hasAnyData()" class="bracket-info-notice">
        <span class="bracket-info-icon">ℹ️</span>
        <span class="bracket-info-text" v-if="isAdmin">El bracket aún no fue inicializado. Hacé click en "Inicializar Bracket" para crear los 32 partidos con las fechas del Mundial.</span>
        <span class="bracket-info-text" v-else>El administrador va a inicializar los brackets en cuanto termine la fase de grupos. 🏆</span>
      </div>

      <div class="bracket-view-toggle" title="Cambiar vista">
        <button class="view-toggle-btn" :class="{active: viewMode === 'list'}" @click="viewMode = 'list'" aria-label="Vista lista">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button class="view-toggle-btn" :class="{active: viewMode === 'tree'}" @click="viewMode = 'tree'" aria-label="Vista torneo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v2"/><path d="M6 17v-2h12v2"/></svg>
        </button>
      </div>

      <div class="bracket-filters">
        <button class="bracket-chip" :class="{active: activeRound === 'all'}" @click="activeRound = 'all'">Todas</button>
        <button class="bracket-chip chip-r32" :class="{active: activeRound === 'r32'}" @click="scrollTo('r32')">16avos</button>
        <button class="bracket-chip chip-r16" :class="{active: activeRound === 'r16'}" @click="scrollTo('r16')">8vos</button>
        <button class="bracket-chip chip-qf" :class="{active: activeRound === 'qf'}" @click="scrollTo('qf')">4tos</button>
        <button class="bracket-chip chip-sf" :class="{active: activeRound === 'sf'}" @click="scrollTo('sf')">Semifinal</button>
        <button class="bracket-chip chip-third" :class="{active: activeRound === 'third'}" @click="scrollTo('third')">3.er lugar</button>
        <button class="bracket-chip chip-final" :class="{active: activeRound === 'final'}" @click="scrollTo('final')">Final</button>
      </div>

      <div v-if="viewMode === 'list'" class="bracket-list-view">

      <!-- ============ DIECISEISAVOS (R32) ============ -->
      <section v-show="isVisible('r32')" ref="section_r32" class="bracket-section section-r32" data-round="r32">
        <div class="section-stripe stripe-r32"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('r32').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('r32').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('r32').pillClass">{{ roundLabels('r32').pill }}</span>
          </div>
          <div v-if="bracket.r32.length === 0" class="bracket-empty">Aún no hay partidos. Inicializá el bracket para crear los 16 partidos.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.r32" :key="m.id" class="match-card match-r32">
              <div class="match-meta">
                <span class="match-id">dieciseisavos #{{ m.position }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <span class="team-pos">A</span>
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" :title="'Editar equipo'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <span class="team-pos">B</span>
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" :title="'Editar equipo'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r32') || isVisible('r16')) && hasAnyData()" class="bracket-link link-down link-blue">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
      </div>

      <!-- ============ OCTAVOS (R16) ============ -->
      <section v-show="isVisible('r16')" ref="section_r16" class="bracket-section section-r16" data-round="r16">
        <div class="section-stripe stripe-r16"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('r16').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('r16').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('r16').pillClass">{{ roundLabels('r16').pill }}</span>
          </div>
          <div v-if="bracket.r16.length === 0" class="bracket-empty">Los octavos se generan al ganar partidos en 16avos.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.r16" :key="m.id" class="match-card match-r16">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('r16_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 16avos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 16avos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r16') || isVisible('qf')) && hasAnyData()" class="bracket-link link-down link-cyan">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
      </div>

      <!-- ============ CUARTOS (QF) ============ -->
      <section v-show="isVisible('qf')" ref="section_qf" class="bracket-section section-qf" data-round="qf">
        <div class="section-stripe stripe-qf"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('qf').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('qf').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('qf').pillClass">{{ roundLabels('qf').pill }}</span>
          </div>
          <div v-if="bracket.qf.length === 0" class="bracket-empty">Los cuartos se generan al ganar partidos en octavos.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.qf" :key="m.id" class="match-card match-qf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('qf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 8vos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 8vos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('qf') || isVisible('sf')) && hasAnyData()" class="bracket-link link-down link-orange">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
      </div>

      <!-- ============ SEMIFINALES (SF) ============ -->
      <section v-show="isVisible('sf')" ref="section_sf" class="bracket-section section-sf" data-round="sf">
        <div class="section-stripe stripe-sf"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('sf').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('sf').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('sf').pillClass">{{ roundLabels('sf').pill }}</span>
          </div>
          <div v-if="bracket.sf.length === 0" class="bracket-empty">Las semis se generan al ganar partidos en cuartos.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.sf" :key="m.id" class="match-card match-sf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('sf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 4tos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 4tos' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('sf') || isVisible('third')) && hasAnyData()" class="bracket-link link-down link-red">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
      </div>

      <!-- ============ PARTIDO POR EL 3.er LUGAR ============ -->
      <section v-show="isVisible('third')" ref="section_third" class="bracket-section section-third" data-round="third">
        <div class="section-stripe stripe-third"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('third').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('third').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('third').pillClass">{{ roundLabels('third').pill }}</span>
          </div>
          <div v-if="bracket.third.length === 0" class="bracket-empty">El partido por el 3.er lugar se genera con los perdedores de las semis.</div>
          <div v-else class="matches-grid grid-1">
            <div v-for="m in bracket.third" :key="m.id" class="match-card match-third">
              <div class="match-meta">
                <span class="match-id">3.er LUGAR</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Perdedor SF 1' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">🥉</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Perdedor SF 2' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">🥉</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('third') || isVisible('final')) && hasAnyData()" class="bracket-link link-down link-bronze">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
      </div>

      <!-- ============ FINAL — BOTTOM ============ -->
      <section v-show="isVisible('final')" ref="section_final" class="bracket-section section-final" data-round="final">
        <div class="section-stripe stripe-final"></div>
        <div class="section-inner">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">{{ roundLabels('final').eyebrow }}</div>
              <div class="section-meta">{{ roundLabels('final').meta }}</div>
            </div>
            <span class="section-pill" :class="roundLabels('final').pillClass">{{ roundLabels('final').pill }}</span>
          </div>
          <div v-if="bracket.final.length === 0" class="bracket-empty">La final se genera al ganar las semis.</div>
          <div v-else class="matches-grid grid-1">
            <div v-for="m in bracket.final" :key="m.id" class="match-card match-final">
              <div class="match-meta">
                <span class="match-id">FINAL</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'home' }]">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Ganador SF 1' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'home'" class="team-trophy">🏆</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
              <div class="team-divider"></div>
              <div :class="['team-row', { 'team-row-winner': m.winner === 'away' }]">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Ganador SF 2' }}</span>
                <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;padding:0 0.2rem;">✎</button>
                <span v-if="m.winner === 'away'" class="team-trophy">🏆</span>
                <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" style="background:#fde68a;border:1px solid #f59e0b;color:#92400e;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.6rem;font-weight:700;cursor:pointer;margin-left:0.25rem;">GANA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      </div> <!-- /bracket-list-view -->

      <!-- ============ VISTA TORNEO ============ -->
      <div v-else-if="viewMode === 'tree' && hasAnyData()" class="bracket-tree-view">
        <div class="bracket-tree-scroll">
          <div class="bracket-tree">
          <!-- LEFT HALF -->
          <div class="tree-side tree-side-left">
            <div class="tree-column" data-round="r32">
              <div v-for="pos in 8" :key="'l_r32_' + pos" :class="['tree-match', 'tree-match-r32', { 'tree-match-last': isTreeLast('r32', pos) }]">
                <div class="tree-match-connector connector-right"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('r32', pos)" v-for="m in [matchByRoundPosition('r32', pos)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('r32', pos) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('r32') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('r32') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('r32', pos) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Por definir</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Por definir</span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="r16">
              <div v-for="pos in 4" :key="'l_r16_' + pos" :class="['tree-match', 'tree-match-r16', { 'tree-match-last': isTreeLast('r16', pos) }]">
                <div class="tree-match-connector connector-right"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('r16', pos)" v-for="m in [matchByRoundPosition('r16', pos)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('r16', pos) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 16avos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('r16') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 16avos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('r16') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('r16', pos) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 16avos</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 16avos</span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="qf">
              <div v-for="pos in 2" :key="'l_qf_' + pos" :class="['tree-match', 'tree-match-qf', { 'tree-match-last': isTreeLast('qf', pos) }]">
                <div class="tree-match-connector connector-right"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('qf', pos)" v-for="m in [matchByRoundPosition('qf', pos)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('qf', pos) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 8vos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('qf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 8vos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('qf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('qf', pos) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 8vos</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 8vos</span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="sf">
              <div v-for="pos in 1" :key="'l_sf_' + pos" :class="['tree-match', 'tree-match-sf', { 'tree-match-last': isTreeLast('sf', pos) }]">
                <div class="tree-match-connector connector-right"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('sf', pos)" v-for="m in [matchByRoundPosition('sf', pos)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('sf', pos) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 4tos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('sf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 4tos' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('sf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('sf', pos) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 4tos</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador 4tos</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- CENTER -->
          <div class="tree-center">
            <div class="tree-center-final">
              <div :class="treeMatchClass('final')">
                <div class="tree-match-inner" v-if="matchByRoundPosition('final', 1)" v-for="m in [matchByRoundPosition('final', 1)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('final', 1) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador SF 1' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('final') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador SF 2' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('final') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">FINAL</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador SF 1</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Ganador SF 2</span></div>
                </div>
              </div>
            </div>
            <div class="tree-center-third">
              <div :class="treeMatchClass('third')">
                <div class="tree-match-inner" v-if="matchByRoundPosition('third', 1)" v-for="m in [matchByRoundPosition('third', 1)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('third', 1) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Perdedor SF 1' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('third') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Perdedor SF 2' }}</span>
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('third') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">3.ER LUGAR</span></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Perdedor SF 1</span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-flag tree-flag-empty"></span><span class="tree-team-name tree-team-tbd">Perdedor SF 2</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT HALF -->
          <div class="tree-side tree-side-right">
            <div class="tree-column" data-round="sf">
              <div v-for="pos in 1" :key="'r_sf_' + pos" :class="['tree-match', 'tree-match-sf', { 'tree-match-last': isTreeLast('sf', pos) }]">
                <div class="tree-match-connector connector-left"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('sf', pos + 1)" v-for="m in [matchByRoundPosition('sf', pos + 1)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('sf', pos + 1) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 4tos' }}</span>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('sf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 4tos' }}</span>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('sf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('sf', pos + 1) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 4tos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 4tos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="qf">
              <div v-for="pos in 2" :key="'r_qf_' + pos" :class="['tree-match', 'tree-match-qf', { 'tree-match-last': isTreeLast('qf', pos) }]">
                <div class="tree-match-connector connector-left"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('qf', pos + 2)" v-for="m in [matchByRoundPosition('qf', pos + 2)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('qf', pos + 2) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 8vos' }}</span>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('qf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 8vos' }}</span>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('qf') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('qf', pos + 2) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 8vos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 8vos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="r16">
              <div v-for="pos in 4" :key="'r_r16_' + pos" :class="['tree-match', 'tree-match-r16', { 'tree-match-last': isTreeLast('r16', pos) }]">
                <div class="tree-match-connector connector-left"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('r16', pos + 4)" v-for="m in [matchByRoundPosition('r16', pos + 4)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('r16', pos + 4) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Ganador 16avos' }}</span>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('r16') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Ganador 16avos' }}</span>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('r16') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('r16', pos + 4) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 16avos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Ganador 16avos</span><span class="tree-team-flag tree-flag-empty"></span></div>
                </div>
              </div>
            </div>
            <div class="tree-column" data-round="r32">
              <div v-for="pos in 8" :key="'r_r32_' + pos" :class="['tree-match', 'tree-match-r32', { 'tree-match-last': isTreeLast('r32', pos) }]">
                <div class="tree-match-connector connector-left"></div>
                <div class="tree-match-inner" v-if="matchByRoundPosition('r32', pos + 8)" v-for="m in [matchByRoundPosition('r32', pos + 8)]" :key="m.id">
                  <div class="tree-match-meta">
                    <span class="tree-match-id">{{ treeMatchIdLabel('r32', pos + 8) }}</span>
                    <span class="tree-match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }}</span>
                  </div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'home' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'home')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                    <span v-if="m.winner === 'home'" class="tree-team-trophy">{{ treeWinnerIcon('r32') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'home')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                  <div class="tree-team-divider"></div>
                  <div :class="['tree-team-row', { 'tree-team-winner': m.winner === 'away' }]">
                    <button v-if="isAdmin" @click="openTeamEdit(m.id, 'away')" class="tree-edit-btn" title="Editar equipo">✎</button>
                    <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="tree-team-flag">
                    <span v-else class="tree-team-flag tree-flag-empty"></span>
                    <span class="tree-team-name" :class="{'tree-team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                    <span v-if="m.winner === 'away'" class="tree-team-trophy">{{ treeWinnerIcon('r32') }}</span>
                    <button v-if="isAdmin && m.home_team && m.away_team && !m.winner" @click="openWinnerConfirm(m.id, 'away')" :disabled="actionInProgress === 'winner-' + m.id" class="tree-win-btn">GANA</button>
                  </div>
                </div>
                <div class="tree-match-inner tree-match-empty" v-else>
                  <div class="tree-match-meta"><span class="tree-match-id">{{ treeMatchIdLabel('r32', pos + 8) }}</span></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Por definir</span><span class="tree-team-flag tree-flag-empty"></span></div>
                  <div class="tree-team-divider"></div>
                  <div class="tree-team-row"><span class="tree-team-name tree-team-tbd">Por definir</span><span class="tree-team-flag tree-flag-empty"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- Team Edit Modal (Teleport to body) -->
      <Teleport to="body">
      <div v-if="teamEdit.open" class="bracket-winner-modal-overlay" @click.self="closeTeamEdit">
        <div class="modal-content bracket-winner-modal" data-dark-bg="card" data-dark-border="border">
          <h3 data-dark-text="text" style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 1rem;text-align:center;">EDITAR EQUIPO</h3>
          <div style="margin-bottom:0.75rem;">
            <label style="font-size:0.7rem;font-weight:700;display:block;margin-bottom:0.25rem;">Equipo</label>
            <input v-model="teamEdit.team" list="bracket-teams" class="form-input" style="width:100%;padding:0.5rem;border:1.5px solid #e2e8f0;border-radius:8px;font-family:var(--font-main);font-size:0.85rem;" placeholder="Seleccioná un país">
            <datalist id="bracket-teams">
              <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
            </datalist>
          </div>
          <div style="margin-bottom:1rem;">
            <label style="font-size:0.7rem;font-weight:700;display:block;margin-bottom:0.25rem;">Seed (opcional, 1-4)</label>
            <input v-model.number="teamEdit.seed" type="number" min="1" max="4" class="form-input" style="width:100%;padding:0.5rem;border:1.5px solid #e2e8f0;border-radius:8px;font-family:var(--font-main);font-size:0.85rem;">
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="closeTeamEdit" style="flex:1;padding:0.6rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;">CANCELAR</button>
            <button @click="saveTeamEdit" :disabled="actionInProgress === 'team-' + teamEdit.bracketId" style="flex:1;padding:0.6rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;">{{ actionInProgress === 'team-' + teamEdit.bracketId ? 'GUARDANDO...' : 'GUARDAR' }}</button>
          </div>
        </div>
      </div>
      </Teleport>

      <!-- Winner Confirm Modal (Teleport to body to avoid transform/position:fixed issues) -->
      <Teleport to="body">
      <div v-if="winnerConfirm.open" class="bracket-winner-modal-overlay" @click.self="closeWinnerConfirm">
        <div class="modal-content bracket-winner-modal" data-dark-bg="card" data-dark-border="border">
          <div style="text-align:center;margin-bottom:1rem;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">🏆</div>
            <h3 data-dark-text="text" style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 0.5rem;">CONFIRMAR GANADOR</h3>
            <p style="font-size:0.85rem;color:var(--color-gray);margin:0;">¿Clasificar a <strong data-dark-text="text" style="color:var(--color-dark);">{{ winnerConfirm.teamName }}</strong> como ganador?</p>
          </div>
          <div v-if="winnerConfirm.nextMatchInfo" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:1.25rem;text-align:center;">
            <div style="font-size:0.7rem;font-weight:700;color:#0c4a6e;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:0.15rem;">{{ winnerConfirm.nextMatchInfo }}</div>
            <div style="font-size:0.65rem;color:#0369a1;">El equipo se asignará automáticamente al próximo partido</div>
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="closeWinnerConfirm" style="flex:1;padding:0.7rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;">NO, CANCELAR</button>
            <button @click="confirmWinner" style="flex:1.5;padding:0.7rem;border:none;border-radius:8px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:white;font-weight:700;cursor:pointer;font-size:0.85rem;box-shadow:0 4px 12px rgba(245,158,11,0.3);">SÍ, CLASIFICAR</button>
          </div>
        </div>
      </div>
      </Teleport>

    </div>
  `,
};
