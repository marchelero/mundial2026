import { renderGoogleButton } from '../services/auth.js';

const RACE_COLORS = [
  '#a7c7e7', '#f6c6a8', '#b8e0c2', '#f5b7b1', '#d7bde2',
  '#f9e79f', '#aed6f1', '#f5cba7', '#abebc6', '#fadbd8',
  '#d4efdf', '#fdebd0', '#d6eaf8', '#fce4ec', '#e8daef',
  '#d1f2eb', '#fcf3cf', '#eafaf1', '#fdedec', '#f4ecf7',
];

export default {
  props: ['landingData', 'authError'],
  data() {
    return {
      showAll: false,
      showAllTop5: false,
      showRace: false,
      raceTimer: null,
      _chart: null,
      championWinner: '',
      mentions: [],
      expandedMentions: new Set(),
      allExpandedFlag: false,
    };
  },
  computed: {
    rankings() { return this.landingData?.rankings || []; },
    stats() { return this.landingData?.stats || {}; },
    finishedMatches() { return this.landingData?.finishedMatches || []; },
    predictions() { return this.landingData?.predictions || []; },
    topUsers() { return this.rankings.slice(0, 10); },
    allUsers() { return this.rankings; },
    raceUsers() { return this.showAll ? this.allUsers : this.topUsers; },
    hasData() { return (this.stats.jugados || 0) > 0; },
    topFiveUsers() { return this.showAllTop5 ? this.rankings : this.rankings.slice(0, 5); },
    isLoading() { return this.landingData == null; },
    raceHeight() {
      const n = this.raceUsers.length;
      if (n <= 10) return 280;
      if (n <= 30) return Math.max(280, n * 26 + 40);
      return 480;
    },
    showExtraSections() { return !!this.championWinner && this.rankings.length > 0; },
    topPositions() {
      const data = this.rankings;
      const positions = { first: [], second: [], third: [], fourth: [], fifth: [] };
      const keys = ['first', 'second', 'third', 'fourth', 'fifth'];
      let i = 0, posIdx = 0;
      while (i < data.length && posIdx < 5) {
        const group = [data[i]];
        let j = i + 1;
        while (j < data.length && data[j].points === data[i].points) { group.push(data[j]); j++; }
        positions[keys[posIdx]] = group;
        posIdx++; i = j;
      }
      return positions;
    },
  },
  methods: {
    podiumUserTooltip(u) { return (u.points || 0) + ' puntos'; },
    isMentionExpanded(idx) { return this.expandedMentions.has(idx); },
    toggleMention(idx) {
      const newSet = new Set(this.expandedMentions);
      if (newSet.has(idx)) newSet.delete(idx);
      else newSet.add(idx);
      this.expandedMentions = newSet;
      this.allExpandedFlag = newSet.size === this.mentions.length;
    },
    toggleAllMentions() {
      if (this.allExpandedFlag) {
        this.expandedMentions = new Set();
        this.allExpandedFlag = false;
      } else {
        const newSet = new Set();
        for (let i = 0; i < this.mentions.length; i++) newSet.add(i);
        this.expandedMentions = newSet;
        this.allExpandedFlag = true;
      }
    },
    _disposeChart() {
      if (this._chart) { this._chart.dispose(); this._chart = null; }
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
    },
    _buildRaceData() {
      const matches = this.finishedMatches;
      const preds = this.predictions;
      const users = this.raceUsers;
      if (!matches.length || !users.length) return [];
      const yKey = {};
      for (const u of users) yKey[u.id] = 0;
      return matches.map(m => {
        const point = { date: m.date, label: m.date.split('-').slice(1).join('/') };
        for (const u of users) {
          const p = preds.find(pp => pp.match_id === m.id && pp.user_id === u.id);
          const pts = p?.points ?? 0;
          yKey[u.id] += pts;
          point[u.id] = yKey[u.id];
        }
        return point;
      });
    },
    renderRace() {
      if (!this.hasData) return;
      const el = this.$refs?.raceContainer;
      if (!el || !window.echarts) return;
      this._disposeChart();
      this._chart = echarts.init(el);
      const dark = document.body.classList.contains('dark-mode');
      const axisColor = dark ? '#94a3b8' : '#64748b';
      const labelColor = dark ? '#e2e8f0' : '#1a1a1a';
      const data = this._buildRaceData();
      const users = this.raceUsers;
      const colors = RACE_COLORS;
      const overflow = users.length > 30;

      const makeOption = (yearData, yearLabel) => {
        const items = yearData.map((v, i) => ({ name: users[i].name, value: v })).sort((a, b) => b.value - a.value);
        const yFontSize = users.length > 20 ? 9 : 11;
        const yLabelWidth = 100;
        const bgFill = dark ? 'rgba(226,232,240,0.06)' : 'rgba(100,100,100,0.10)';
        const splitColor = dark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
        return {
          backgroundColor: 'transparent',
          grid: { top: 10, bottom: 30, left: 10, right: 60, containLabel: true },
          xAxis: {
            max: 'dataMax',
            axisLabel: { fontSize: 10, color: axisColor, formatter: n => Math.round(n) + '' },
            splitLine: { lineStyle: { color: splitColor, type: 'dashed' } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          yAxis: { type: 'category', data: items.map(d => d.name), inverse: true, axisLabel: { fontSize: yFontSize, fontWeight: 700, color: labelColor, width: yLabelWidth, overflow: 'truncate', ellipsis: '…' }, animationDuration: 300, animationDurationUpdate: 300, axisLine: { show: false }, axisTick: { show: false } },
          series: [{
            realtimeSort: true,
            type: 'bar',
            data: items,
            barCategoryGap: '35%',
            itemStyle: {
              color: p => colors[users.findIndex(u => u.name === p.name) % colors.length] || '#a7c7e7',
              borderRadius: [0, 6, 6, 0],
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.08)',
              shadowOffsetX: 0,
              shadowOffsetY: 2,
              opacity: 0.95,
            },
            emphasis: {
              itemStyle: {
                opacity: 1,
                shadowBlur: 12,
                shadowColor: 'rgba(0, 0, 0, 0.15)',
              }
            },
            label: {
              show: true,
              position: 'right',
              valueAnimation: true,
              fontSize: 11,
              fontWeight: 700,
              color: labelColor,
              backgroundColor: dark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)',
              padding: [3, 6],
              borderRadius: 4,
              formatter: p => p.value + ' pts',
              clip: false
            }
          }],
          animationDuration: 500, animationDurationUpdate: 1000, animationEasing: 'linear', animationEasingUpdate: 'linear',
          graphic: { elements: [{ type: 'text', right: 60, bottom: 40, style: { text: yearLabel, font: 'bolder 56px monospace', fill: bgFill }, z: 100 }] }
        };
      };

      if (!data.length) return;
      let idx = 0;
      this._chart.setOption(makeOption(users.map(u => data[idx][u.id] || 0), data[idx].label));
      const step = () => {
        idx++;
        if (idx >= data.length) { idx = 0; }
        this._chart.setOption(makeOption(users.map(u => data[idx][u.id] || 0), data[idx].label));
        this.raceTimer = setTimeout(step, 1500);
      };
      this.raceTimer = setTimeout(step, 1500);
    },
    triggerGoogleLogin() {
      setTimeout(renderGoogleButton, 500);
    },
    _onDarkModeChange() {
      this._disposeChart();
      this.$nextTick(() => this.renderRace());
    },
    _onResize() {
      if (!this._chart) return;
      this._chart.resize();
    },
  },
  watch: {
    raceUsers: {
      handler() { if (this.showRace) this.$nextTick(() => this.renderRace()); },
      deep: true,
    },
    showRace(val) {
      if (val) this.$nextTick(() => this.renderRace());
      else this._disposeChart();
    },
  },
  async mounted() {
    window.addEventListener('dark-mode-change', this._onDarkModeChange);
    window.addEventListener('resize', this._onResize);
    this.triggerGoogleLogin();
    try {
      const r = await fetch('/api/public/champion-winner');
      if (r.ok) {
        const d = await r.json();
        this.championWinner = d.champion_winner || '';
      }
      if (this.championWinner) {
        const m = await fetch('/api/public/mentions');
        if (m.ok) this.mentions = await m.json();
      }
    } catch (e) {}
  },
  unmounted() {
    this._disposeChart();
    window.removeEventListener('dark-mode-change', this._onDarkModeChange);
    window.removeEventListener('resize', this._onResize);
  },
  template: `
    <div class="landing">
      <header class="landing-top">
        <img src="/assets/logo.png" alt="Mundial 2026" class="landing-logo-small">
        <div id="google-signin-btn" class="landing-google-btn"></div>
      </header>

      <div v-if="isLoading" class="landing-loading">
        <p>Cargando datos del torneo…</p>
      </div>

      <template v-else>
        <section class="landing-hero">
          <h1 class="landing-title">POLLA MUNDIALISTA 2026</h1>
          <p class="landing-tagline" v-if="hasData">
            {{ stats.jugados }} de {{ stats.partidos }} partidos jugados
          </p>
          <p class="landing-tagline" v-else>
            El torneo aún no empieza. ¡Inscribite y arrancá con ventaja!
          </p>

          <button
            v-if="hasData"
            @click="showRace = !showRace"
            class="race-toggle-main"
          >
            <span class="race-toggle-main-icon">{{ showRace ? '👁' : '🏁' }}</span>
            <span class="race-toggle-main-text">{{ showRace ? 'OCULTAR COMPETENCIA' : 'VER COMPETENCIA' }}</span>
          </button>

          <div v-if="hasData && showRace" class="race-section">
            <div
              ref="raceContainer"
              class="race-container"
              :style="{
                height: raceHeight + 'px',
                'max-height': '480px',
                'overflow-y': raceUsers.length > 30 ? 'auto' : 'visible'
              }"
            ></div>
            <button
              v-if="allUsers.length > 10"
              @click="showAll = !showAll"
              class="race-toggle-btn"
            >
              {{ showAll ? 'VER TOP 10' : 'VER TODOS (' + allUsers.length + ')' }}
            </button>
          </div>

          <div v-if="!hasData" class="race-empty">
            <div class="race-empty-icon">⚽</div>
            <h3>El torneo aún no empieza</h3>
            <p v-if="stats.proximo">El primer partido es el {{ stats.proximo.date }}.</p>
            <p v-else>Próximamente.</p>
          </div>

          <p v-if="authError" class="error-text" style="color: var(--color-red); margin-top: 1rem;">{{ authError }}</p>
        </section>

        <!-- 🏆 Podio - solo si hay campeón -->
        <section v-if="showExtraSections" class="podium-wrapper">
          <div class="podium-stage">
            <div class="podium-slot second" v-if="topPositions.second.length">
              <div class="podium-stack silver" :title="podiumUserTooltip(topPositions.second[0])">
                <div class="podium-medal-icon">🥈</div>
                <div class="podium-points-big">{{ topPositions.second[0].points }} <span style="font-size:0.5em;font-weight:600;">pts</span></div>
                <div class="podium-names">
                  <div v-for="u in topPositions.second" :key="'2-'+u.id" class="podium-name" :title="u.name">{{ u.name }}</div>
                </div>
                <div class="podium-num-badge silver-num">2</div>
              </div>
            </div>
            <div class="podium-slot first" v-if="topPositions.first.length">
              <div class="podium-stack gold" :title="podiumUserTooltip(topPositions.first[0])">
                <div class="podium-crown">👑</div>
                <div class="podium-medal-icon">🥇</div>
                <div class="podium-points-big">{{ topPositions.first[0].points }} <span style="font-size:0.5em;font-weight:600;">pts</span></div>
                <div class="podium-names">
                  <div v-for="u in topPositions.first" :key="'1-'+u.id" class="podium-name" :title="u.name">{{ u.name }}</div>
                </div>
                <div class="podium-num-badge gold-num">1</div>
              </div>
            </div>
            <div class="podium-slot third" v-if="topPositions.third.length">
              <div class="podium-stack bronze" :title="podiumUserTooltip(topPositions.third[0])">
                <div class="podium-medal-icon">🥉</div>
                <div class="podium-points-big">{{ topPositions.third[0].points }} <span style="font-size:0.5em;font-weight:600;">pts</span></div>
                <div class="podium-names">
                  <div v-for="u in topPositions.third" :key="'3-'+u.id" class="podium-name" :title="u.name">{{ u.name }}</div>
                </div>
                <div class="podium-num-badge bronze-num">3</div>
              </div>
            </div>
          </div>
          <div v-if="topPositions.fourth.length || topPositions.fifth.length" class="podium-stage podium-stage-rest">
            <div class="podium-slot fourth" v-if="topPositions.fourth.length">
              <div class="podium-stack fourth" :title="podiumUserTooltip(topPositions.fourth[0])">
                <div class="podium-points-big">{{ topPositions.fourth[0].points }} <span style="font-size:0.5em;font-weight:600;">pts</span></div>
                <div class="podium-names">
                  <div v-for="u in topPositions.fourth" :key="'4-'+u.id" class="podium-name" :title="u.name">{{ u.name }}</div>
                </div>
                <div class="podium-num-badge fourth-num">4</div>
              </div>
            </div>
            <div class="podium-slot fifth" v-if="topPositions.fifth.length">
              <div class="podium-stack fifth" :title="podiumUserTooltip(topPositions.fifth[0])">
                <div class="podium-points-big">{{ topPositions.fifth[0].points }} <span style="font-size:0.5em;font-weight:600;">pts</span></div>
                <div class="podium-names">
                  <div v-for="u in topPositions.fifth" :key="'5-'+u.id" class="podium-name" :title="u.name">{{ u.name }}</div>
                </div>
                <div class="podium-num-badge fifth-num">5</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 🏅 Menciones - solo si hay campeón -->
        <section v-if="showExtraSections && mentions && mentions.length" class="mentions-wrapper">
          <div class="mentions-header">
            <span class="mentions-icon">🏅</span>
            <div>
              <h3 class="mentions-title">MENCIONES HONORÍFICAS</h3>
              <p class="mentions-subtitle">Galardones extraoficiales del torneo 🎭</p>
            </div>
            <button @click="toggleAllMentions" class="mentions-toggle-all" :title="allExpandedFlag ? 'Colapsar todas' : 'Expandir todas'">
              <span v-if="allExpandedFlag" style="font-size:0.95rem;">▴</span>
              <span v-else style="font-size:0.95rem;">▾</span>
              <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.04em;">{{ allExpandedFlag ? 'COLAPSAR' : 'EXPANDIR' }}</span>
            </button>
          </div>
          <div class="mentions-grid">
            <div v-for="(m, idx) in mentions" :key="idx" class="mention-card" :class="['mention-' + m.color, { 'mention-expanded': isMentionExpanded(idx) }]">
              <div class="mention-header" @click="toggleMention(idx)">
                <div class="mention-emoji">{{ m.emoji }}</div>
                <div class="mention-header-body">
                  <div class="mention-title-text">{{ m.title }}</div>
                  <div class="mention-description">{{ m.description }}</div>
                </div>
                <div class="mention-toggle">
                  <span class="mention-count">{{ m.users.length }}</span>
                  <span class="mention-chevron">{{ isMentionExpanded(idx) ? '▴' : '▾' }}</span>
                </div>
              </div>
              <div v-if="isMentionExpanded(idx)" class="mention-details">
                <div v-for="(u, uidx) in m.users" :key="uidx" class="mention-user">
                  <span class="mention-user-name">{{ u.name }}</span>
                  <span class="mention-user-detail">{{ u.detail }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="landing-stats">
          <div class="stat-card" data-dark-bg="card">
            <div class="stat-value">{{ stats.participantes }}</div>
            <div class="stat-label">PARTICIPANTES</div>
          </div>
          <div class="stat-card" data-dark-bg="card">
            <div class="stat-value">{{ stats.partidos }}</div>
            <div class="stat-label">PARTIDOS</div>
          </div>
          <div class="stat-card" data-dark-bg="card">
            <div class="stat-value">{{ stats.jugados }}</div>
            <div class="stat-label">JUGADOS</div>
          </div>
        </section>

        <section v-if="hasData && topFiveUsers.length" class="landing-top5">
          <h3 class="landing-top5-title">🏆 {{ showAllTop5 ? 'RANKING COMPLETO' : 'TOP 5 ACTUAL' }}</h3>
          <ol class="top5-list">
            <li v-for="(r, i) in topFiveUsers" :key="r.id" class="top5-item" data-dark-bg="card">
              <span class="top5-pos">#{{ i + 1 }}</span>
              <span class="top5-name" data-dark-text="text">{{ r.name }}</span>
              <span class="top5-comodines" v-if="r.comodines_usados > 0">
                <span v-for="n in r.comodines_usados" :key="n">🍀</span>
              </span>
              <span class="top5-pts">{{ r.points }} pts</span>
            </li>
          </ol>
          <button
            v-if="rankings.length > 5"
            @click="showAllTop5 = !showAllTop5"
            class="race-toggle-btn"
          >
            {{ showAllTop5 ? 'VER TOP 5' : 'VER TODOS (' + rankings.length + ')' }}
          </button>
        </section>

        <footer class="landing-footer">
          <small>© 2026 · Hecho con café</small>
        </footer>
      </template>
    </div>
  `,
};
