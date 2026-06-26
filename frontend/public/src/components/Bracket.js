import { flagUrl } from '../utils/helpers.js';

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

const ROUND_SLOTS = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  third: 1,
  final: 1,
};

const ROUND_DATES = {
  r32: ['2026-06-28','2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03'],
  r16: ['2026-07-04','2026-07-05','2026-07-06','2026-07-07'],
  qf:  ['2026-07-11','2026-07-12'],
  sf:  ['2026-07-14','2026-07-15'],
  third: ['2026-07-18'],
  final: ['2026-07-19'],
};

const ROUND_TIMES = {
  r32: ['12:00','15:00','18:00','21:00'],
  r16: ['12:00','15:00','18:00','21:00'],
  qf:  ['15:00','18:00','21:00'],
  sf:  ['18:00','21:00'],
  third: ['15:00'],
  final: ['21:00'],
};

function buildEmptyBracket() {
  const out = {};
  for (const round of ROUND_ORDER) {
    const n = ROUND_SLOTS[round];
    const dates = ROUND_DATES[round];
    const times = ROUND_TIMES[round];
    out[round] = Array.from({ length: n }, (_, i) => ({
      id: `${round}_${i + 1}`,
      home_team: '',
      away_team: '',
      match_date: dates[i % dates.length],
      match_time: times[i % times.length],
    }));
  }
  return out;
}

export default {
  props: ['countries'],
  data() {
    return {
      activeRound: 'all',
      bracket: buildEmptyBracket(),
    };
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
  },
  template: `
    <div class="bracket-modern">

      <div class="bracket-info-notice">
        <span class="bracket-info-icon">ℹ️</span>
        <span class="bracket-info-text">Visualización de brackets del Mundial 2026. Los equipos se cargarán cuando termine la fase de grupos.</span>
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
          <div class="matches-grid grid-2">
            <div v-for="m in bracket.r32" :key="m.id" class="match-card match-r32">
              <div class="match-meta">
                <span class="match-id">dieciseisavos #{{ m.id.split('_')[1] }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-pos">A</span>
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Por definir' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-pos">B</span>
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Por definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r32') || isVisible('r16'))" class="bracket-link link-down link-blue">
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
          <div class="matches-grid grid-2">
            <div v-for="m in bracket.r16" :key="m.id" class="match-card match-r16">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('r16_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Por definir' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Por definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('r16') || isVisible('qf'))" class="bracket-link link-down link-cyan">
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
          <div class="matches-grid grid-2">
            <div v-for="m in bracket.qf" :key="m.id" class="match-card match-qf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('qf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Por definir' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Por definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('qf') || isVisible('sf'))" class="bracket-link link-down link-orange">
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
          <div class="matches-grid grid-2">
            <div v-for="m in bracket.sf" :key="m.id" class="match-card match-sf">
              <div class="match-meta">
                <span class="match-id">{{ m.id.replace('sf_', 'G').toUpperCase() }}</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Por definir' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Por definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('sf') || isVisible('third'))" class="bracket-link link-down link-red">
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
          <div class="matches-grid grid-1">
            <div v-for="m in bracket.third" :key="m.id" class="match-card match-third">
              <div class="match-meta">
                <span class="match-id">3.er LUGAR</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Perdedor SF 1' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Perdedor SF 2' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-show="(isVisible('third') || isVisible('final'))" class="bracket-link link-down link-bronze">
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
          <div class="matches-grid grid-1">
            <div v-for="m in bracket.final" :key="m.id" class="match-card match-final">
              <div class="match-meta">
                <span class="match-id">FINAL</span>
                <span class="match-date">{{ fmtWeekday(m.match_date) }} {{ fmtDate(m.match_date) }} · {{ m.match_time }}</span>
              </div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.home_team || 'Por definir' }}</span>
              </div>
              <div class="team-divider"></div>
              <div class="team-row">
                <span class="team-flag-img team-flag-empty"></span>
                <span class="team-name team-tbd">{{ m.away_team || 'Por definir' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  `,
};
