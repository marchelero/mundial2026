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
  r32:   { eyebrow: '🚀 DIECISEISAVOS DE FINAL', meta: '28 jun – 3 jul · 16 partidos · 32 equipos', pill: '16avos',  pillClass: 'pill-r32' },
  r16:   { eyebrow: '🎯 OCTAVOS DE FINAL',     meta: '4 – 7 jul · 8 partidos',                    pill: 'Octavos', pillClass: 'pill-r16' },
  qf:    { eyebrow: '⚡ CUARTOS DE FINAL',      meta: '11 – 12 jul · 4 partidos',                  pill: 'Cuartos', pillClass: 'pill-qf' },
  sf:    { eyebrow: '🔥 SEMIFINALES',           meta: '14 – 15 jul · 2 partidos',                  pill: 'Semis',   pillClass: 'pill-sf' },
  third: { eyebrow: '🥉 PARTIDO POR EL 3.er LUGAR', meta: '18 jul · 1 partido · perdedores de semis', pill: '3.er lugar', pillClass: 'pill-third' },
  final: { eyebrow: '⭐ FINAL',                 meta: '19 jul · 1 partido · MetLife Stadium',     pill: 'Final',   pillClass: 'pill-final' },
};

export default {
  props: ['countries', 'isAdmin'],
  emits: ['notify'],
  data() {
    return {
      activeRound: 'all',
      bracket: null,
      loading: true,
      actionInProgress: null,
    };
  },
  async mounted() {
    await this.loadBracket();
  },
  methods: {
    flagUrl,
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
        this.bracket = { r32: [], r16: [], qf: [], sf: [], final: [] };
      }
      this.loading = false;
    },
    async initBracket() {
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
      if (!confirm('¿Reiniciar todo el bracket? Se perderán los ganadores cargados.')) return;
      this.actionInProgress = 'reset';
      try {
        const r = await api.post('/bracket/reset', {});
        this.notify(r.message || 'Bracket reiniciado', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al reiniciar', 'error');
      }
      this.actionInProgress = null;
    },
    async refreshR32() {
      this.actionInProgress = 'refresh';
      try {
        const r = await api.post('/bracket/refresh-r32', {});
        this.notify(r.message || 'R32 actualizado', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al actualizar', 'error');
      }
      this.actionInProgress = null;
    },
    async setWinner(matchId, winner) {
      this.actionInProgress = matchId;
      try {
        const r = await api.post(`/bracket/match/${encodeURIComponent(matchId)}/winner`, { winner });
        this.notify(r.message || 'Ganador guardado', 'success');
        await this.loadBracket();
      } catch (e) {
        this.notify(e.message || 'Error al guardar', 'error');
      }
      this.actionInProgress = null;
    },
    notify(message, type = 'success') {
      this.$emit('notify', { message, type });
    },
    hasR32Data() {
      return this.bracket && this.bracket.r32 && this.bracket.r32.length > 0;
    },
    roundEmpty(roundKey) {
      if (!this.bracket) return true;
      const arr = this.bracket[roundKey];
      return !arr || arr.length === 0;
    },
  },
  template: `
    <div class="bracket-modern">

      <div v-if="!hasR32Data()" class="bracket-info-notice" data-dark-border="border">
        <span class="bracket-info-icon">ℹ️</span>
        <span class="bracket-info-text" v-if="isAdmin">El bracket aún no fue inicializado. Andá a <strong>ADMIN → CONFIGURACIÓN</strong> para inicializarlo.</span>
        <span class="bracket-info-text" v-else>El administrador va a inicializar los brackets en cuanto termine la fase de grupos. ¡Pronto habrá partidos para pronosticar! 🏆</span>
      </div>

      <div class="bracket-filters" data-dark-border="border">
        <button class="bracket-chip" :class="{active: activeRound === 'all'}" @click="activeRound = 'all'">Todas</button>
        <button class="bracket-chip chip-r32" :class="{active: activeRound === 'r32'}" @click="scrollTo('r32')">Dieciseisavos</button>
        <button class="bracket-chip chip-r16" :class="{active: activeRound === 'r16'}" @click="scrollTo('r16')">Octavos</button>
        <button class="bracket-chip chip-qf" :class="{active: activeRound === 'qf'}" @click="scrollTo('qf')">Cuartos</button>
        <button class="bracket-chip chip-sf" :class="{active: activeRound === 'sf'}" @click="scrollTo('sf')">Semis</button>
        <button class="bracket-chip chip-third" :class="{active: activeRound === 'third'}" @click="scrollTo('third')">3.er lugar</button>
        <button class="bracket-chip chip-final" :class="{active: activeRound === 'final'}" @click="scrollTo('final')">Final</button>
      </div>

      <!-- ============ DIECISEISAVOS (R32) — TOP ============ -->
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
          <div v-if="roundEmpty('r32')" class="bracket-empty">Aún no hay partidos. Inicializá el bracket para cargar los 16 partidos de dieciseisavos.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.r32" :key="m.id" class="match-card match-r32">
              <div class="match-meta">
                <span class="match-id">dieciseisavos #{{ m.position }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <span class="team-pos">{{ m.home_label }}</span>
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <span class="team-pos">{{ m.away_label }}</span>
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>

              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r32') || isVisible('r16')) && hasR32Data()" class="bracket-link link-down link-blue">
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
          <div v-if="roundEmpty('r16')" class="bracket-empty">Los octavos se generan automáticamente al inicializar el bracket.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.r16" :key="m.id" class="match-card match-r16">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('r16_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>

              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r16') || isVisible('qf')) && hasR32Data()" class="bracket-link link-down link-cyan">
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
          <div v-if="roundEmpty('qf')" class="bracket-empty">Los cuartos se generan automáticamente al inicializar el bracket.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.qf" :key="m.id" class="match-card match-qf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('qf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>

              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('qf') || isVisible('sf')) && hasR32Data()" class="bracket-link link-down link-orange">
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
          <div v-if="roundEmpty('sf')" class="bracket-empty">Las semis se generan automáticamente al inicializar el bracket.</div>
          <div v-else class="matches-grid grid-2">
            <div v-for="m in bracket.sf" :key="m.id" class="match-card match-sf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('sf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">★</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">★</span>

              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('sf') || isVisible('third')) && hasR32Data()" class="bracket-link link-down link-red">
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
          <div v-if="roundEmpty('third')" class="bracket-empty">El partido por el 3.er lugar se genera automáticamente al inicializar el bracket. Lo juegan los perdedores de las semifinales.</div>
          <div v-else class="matches-grid grid-1">
            <div v-for="m in bracket.third" :key="m.id" class="match-card match-third">
              <div class="match-meta">
                <span class="match-id">G{{ m.id.replace('third_', '').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Perdedor SF 1' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">🥉</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Perdedor SF 2' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">🥉</span>

              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('third') || isVisible('final')) && hasR32Data()" class="bracket-link link-down link-bronze">
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
          <div v-if="roundEmpty('final')" class="bracket-empty">La final se genera automáticamente al inicializar el bracket.</div>
          <div v-else class="matches-grid grid-1">
            <div v-for="m in bracket.final" :key="m.id" class="match-card match-final">
              <div class="match-meta">
                <span class="match-id">G{{ m.id.replace('final_', '').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'home', 'team-row-clickable': isAdmin && m.home_team, 'team-row-disabled': isAdmin && !m.home_team}">
                <img v-if="teamFlag(m.home_team)" :src="teamFlag(m.home_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.home_team}">{{ m.home_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'home'" class="team-trophy">🏆</span>

              </div>
              <div class="team-divider"></div>
              <div class="team-row" :class="{'team-row-winner': m.winner === 'away', 'team-row-clickable': isAdmin && m.away_team, 'team-row-disabled': isAdmin && !m.away_team}">
                <img v-if="teamFlag(m.away_team)" :src="teamFlag(m.away_team)" alt="" class="team-flag-img">
                <span v-else class="team-flag-img team-flag-empty"></span>
                <span class="team-name" :class="{'team-tbd': !m.away_team}">{{ m.away_team || 'Por definir' }}</span>
                <span v-if="m.winner === 'away'" class="team-trophy">🏆</span>

              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  `,
};
