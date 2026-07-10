import { api } from '../services/api.js';

export default {
  props: ['rankingsData', 'rankingsLoading', 'allMatches'],
  data() {
    return {
      expandedUser: null, userBreakdown: null, statFilter: null, userPreds: [],
      championPickLabel: '',
      showCompare: false, compareUsers: [], comparePredictions: {}, compareTab: 'table',
      compareColors: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
      compareLoading: {}, compareError: {}, raceTimer: null
    };
  },
  computed: {
    totalMatches() { return this.allMatches.length; },
    playedMatches() { return this.allMatches.filter(m => m.status === 'finished').length; },
    rankingsWithPrize() {
      const LABELS = [
        { label: '1ro 45%', color: '#f59e0b' },
        { label: '2do 25%', color: '#6b7280' },
        { label: '3ro 15%', color: '#b45309' },
        { label: '4to 10%', color: '#3b82f6' },
        { label: '5to 5%',  color: '#10b981' },
      ];
      const data = this.rankingsData || [];
      const result = [];
      let rank = 0, i = 0;
      while (i < data.length) {
        const group = [data[i]];
        let j = i + 1;
        while (j < data.length && data[j].points === data[i].points) { group.push(data[j]); j++; }
        const prizeInfo = rank < LABELS.length ? LABELS[rank] : null;
        for (const u of group) result.push({ ...u, prize: prizeInfo });
        rank++; i = j;
      }
      return result;
    },
    compareReady() { return this.compareUsers.length >= 2; },
    compareAllLoaded() {
      if (!this.compareUsers.length) return true;
      return this.compareUsers.every(u => !this.compareLoading[u.id] && this.comparePredictions[u.id] !== undefined);
    },
    compareLoadingCount() { return this.compareUsers.filter(u => this.compareLoading[u.id]).length; },
    compareErrorUsers() { return this.compareUsers.filter(u => this.compareError[u.id]); },
    compareHistory() {
      if (!this.compareReady) return [];
      const finished = this.allMatches.filter(m => m.status === 'finished').sort((a,b) => (a.date+' '+a.time).localeCompare(b.date+' '+b.time));
      return finished.map(m => {
        const row = { match: m, users: {} };
        for (const u of this.compareUsers) {
          const preds = this.comparePredictions[u.id];
          if (!preds) { row.users[u.id] = null; continue; }
          const p = preds.find(p => p.match === m.id);
          if (!p) { row.users[u.id] = null; continue; }
          const pts = p.points ?? 0;
          row.users[u.id] = { home: p.home_score, away: p.away_score, pts, comodin: !!p.comodin };
        }
        return row;
      });
    },
    compareChartData() {
      const history = this.compareHistory;
      if (!history.length) return [];
      const yKey = {};
      for (const u of this.compareUsers) yKey[u.id] = 0;
      return history.map((row, idx) => {
        const point = { date: row.match.date, label: row.match.date.split('-').slice(1).join('/') };
        let totalPts = 0;
        for (const u of this.compareUsers) {
          if (row.users[u.id]) totalPts += row.users[u.id].pts;
          yKey[u.id] += row.users[u.id] ? row.users[u.id].pts : 0;
          point[u.id] = yKey[u.id];
        }
        point.total = totalPts;
        return point;
      });
    },
    maxY() {
      const data = this.compareChartData;
      if (!data.length) return 1;
      let max = 0;
      for (const point of data)
        for (const u of this.compareUsers)
          if (point[u.id] > max) max = point[u.id];
      return max || 1;
    }
  },
  methods: {
    championTooltip(r) {
      if (!r.champion_pick) return '';
      if (r.champion_status === 'winner') return `🏆 ¡${r.champion_pick} es el campeón del mundo!`;
      if (r.champion_status === 'alive') return `🏆 Predijo campeón: ${r.champion_pick} (sigue en carrera)`;
      return `🏆 Predijo campeón: ${r.champion_pick} (ya fue eliminado)`;
    },
    championIcon(status) {
      if (status === 'winner') return '👑';
      return '🏆';
    },
    isFinalWin(match, pred) {
      if (!match || !pred) return false;
      if (match.round !== 'final') return false;
      if (match.status !== 'finished') return false;
      if (match.home_score == null || match.away_score == null) return false;
      if (pred.home == null || pred.away == null) return false;
      if (pred.home === match.home_score && pred.away === match.away_score) return true;
      const pd = pred.home - pred.away;
      const rd = match.home_score - match.away_score;
      if ((pd === 0 && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) return true;
      return false;
    },
    async toggleUser(userId) {
      if (this.expandedUser === userId) {
        this.expandedUser = null; this.userBreakdown = null; this.statFilter = null; this.userPreds = [];
        return;
      }
      try {
        const records = await api.get('/predictions/rankings');
        const userPreds = records.filter(r => r.user === userId);
        this.userPreds = userPreds;
        let exactos = 0, resultados = 0, errors = 0, comodines = 0, pendientes = 0, exactoPts = 0, resultadoPts = 0;
        const finishedMatches = this.allMatches.filter(m => m.status === 'finished');
        const allMatchMap = new Map(this.allMatches.map(m => [m.id, m]));
        userPreds.forEach(p => {
          const match = finishedMatches.find(m => m.id === p.match);
          if (p.comodin) comodines++;
          if (!match || match.home_score == null) {
            const m = allMatchMap.get(p.match);
            if (m) pendientes++;
            return;
          }
          const ph = Number(p.home_score), pa = Number(p.away_score);
          const mh = Number(match.home_score), ma = Number(match.away_score);
          if (ph === mh && pa === ma) { exactos++; exactoPts += p.comodin ? 6 : 3; }
          else {
            const pd = ph - pa, rd = mh - ma;
            if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) { resultados++; resultadoPts += p.comodin ? 2 : 1; }
            else errors++;
          }
        });
        const champPicks = await api.get('/champion-picks/all').catch(() => []);
        const champPick = champPicks.find(cp => cp.user === userId);
        const settings = await api.get('/settings').catch(() => []);
        const settingsMap = {};
        for (const s of settings) settingsMap[s.key] = s.value;
        const championWinner = settingsMap.champion_winner || '';
        const champBonus = (champPick && championWinner && champPick.champion === championWinner) ? 5 : 0;
        this.championPickLabel = champPick?.champion || '';
        this.userBreakdown = { exactos, resultados, errors, comodines, pendientes, champBonus, exactoPts, resultadoPts };
        this.statFilter = null;
        this.expandedUser = userId;
      } catch (_) { this.userBreakdown = null; this.statFilter = null; this.expandedUser = userId; }
    },
    getStatMatches(type) {
      if (!this.userPreds.length) return [];
      const finishedMatches = this.allMatches.filter(m => m.status === 'finished');
      const allMatchMap = new Map(this.allMatches.map(m => [m.id, m]));
      if (type === 'pendientes') {
        return this.userPreds
          .map(p => allMatchMap.get(p.match))
          .filter(m => m && m.status !== 'finished')
          .map(m => {
            const p = this.userPreds.find(pp => pp.match === m.id);
            return p ? { match: m, pred: { home: p.home_score, away: p.away_score }, comodin: !!p.comodin } : null;
          })
          .filter(Boolean);
      }
      const matches = finishedMatches;
      return this.userPreds.filter(p => {
        const match = matches.find(m => m.id === p.match);
        if (!match || match.home_score == null) return false;
        const ph = Number(p.home_score), pa = Number(p.away_score);
        const mh = Number(match.home_score), ma = Number(match.away_score);
        const exact = ph === mh && pa === ma;
        const result = !exact && ((ph - pa === mh - ma && mh - ma === 0) || (ph - pa > 0 && mh - ma > 0) || (ph - pa < 0 && mh - ma < 0));
        if (type === 'exact') return exact;
        if (type === 'result') return result;
        if (type === 'wrong') return !exact && !result;
        return false;
      }).map(p => {
        const match = matches.find(m => m.id === p.match);
        return match ? { match, pred: { home: p.home_score, away: p.away_score }, comodin: !!p.comodin } : null;
      }).filter(Boolean);
    },
    toggleStat(type) { this.statFilter = this.statFilter === type ? null : type; },
    renderChart() {
      if (this.compareTab !== 'chart' || !this.compareChartData.length || !this.compareAllLoaded) return;
      const el = this.$refs?.chartContainer;
      if (!el) return;
      if (!window.echarts) return;
      if (this._chart) this._chart.dispose();
      this._chart = echarts.init(el);
      const dark = document.body.classList.contains('dark-mode');
      const axisColor = dark ? '#94a3b8' : '#64748b';
      const splitColor = dark ? '#334155' : '#f1f5f9';
      const dates = this.compareChartData.map(p => p.label);
      const series = this.compareUsers.map((u, idx) => ({
        name: u.name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3 },
        itemStyle: { color: this.compareColors[idx] },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: this.compareColors[idx] + '55' }, { offset: 1, color: this.compareColors[idx] + '05' }]) },
        data: this.compareChartData.map(p => p[u.id])
      }));
      this._chart.setOption({
        tooltip: { trigger: 'axis', backgroundColor: dark ? '#1e293b' : '#ffffff', borderColor: dark ? '#334155' : '#e2e8f0', textStyle: { color: dark ? '#e2e8f0' : '#1a1a1a' } },
        legend: { data: this.compareUsers.map(u => u.name), bottom: 0, textStyle: { fontSize: 11, color: axisColor } },
        grid: { left: 40, right: 15, top: 20, bottom: 35 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, fontWeight: 600, color: axisColor }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: splitColor } }, axisLabel: { fontSize: 10, color: axisColor } },
        series
      });
    },
    renderRace() {
      if (this.compareTab !== 'race' || !this.compareChartData.length || !this.compareAllLoaded) return;
      const el = this.$refs?.chartContainer;
      if (!el || !window.echarts) return;
      if (this._chart) this._chart.dispose();
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
      this._chart = echarts.init(el);
      const data = this.compareChartData;
      const users = this.compareUsers;
      const colors = this.compareColors;
      const dark = document.body.classList.contains('dark-mode');
      const axisColor = dark ? '#94a3b8' : '#64748b';
      const labelColor = dark ? '#e2e8f0' : '#1a1a1a';
      const bgFill = dark ? 'rgba(226,232,240,0.08)' : 'rgba(100,100,100,0.15)';
      
      function makeOption(yearData, yearLabel) {
        const items = yearData.map((v, i) => ({ name: users[i].name, value: v })).sort((a, b) => b.value - a.value);
        return {
          grid: { top: 10, bottom: 30, left: 100, right: 60 },
          xAxis: { max: 'dataMax', axisLabel: { fontSize: 10, color: axisColor, formatter: n => Math.round(n) + '' } },
          yAxis: { type: 'category', data: items.map(d => d.name), inverse: true, axisLabel: { fontSize: 12, fontWeight: 700, color: labelColor }, animationDuration: 300, animationDurationUpdate: 300 },
          series: [{
            realtimeSort: true, type: 'bar', data: items,
            itemStyle: { color: p => colors[users.findIndex(u => u.name === p.name)] || '#5470c6' },
            label: { show: true, position: 'right', valueAnimation: true, fontSize: 11, fontWeight: 700, color: labelColor, formatter: p => p.value + ' pts' }
          }],
          animationDuration: 500, animationDurationUpdate: 1000, animationEasing: 'linear', animationEasingUpdate: 'linear',
          graphic: { elements: [{ type: 'text', right: 80, bottom: 50, style: { text: yearLabel, font: 'bolder 60px monospace', fill: bgFill }, z: 100 }] }
        };
      }
      
      let idx = 0;
      this._chart.setOption(makeOption(users.map(u => data[idx][u.id] || 0), data[idx].label));
      const step = () => {
        idx++;
        if (idx >= data.length) { this.raceTimer = null; return; }
        this._chart.setOption(makeOption(users.map(u => data[idx][u.id] || 0), data[idx].label));
        this.raceTimer = setTimeout(step, 1500);
      };
      this.raceTimer = setTimeout(step, 1500);
    },
    addCompareUser(userId) {
      if (this.compareUsers.length >= 4) return;
      if (this.compareUsers.find(u => u.id === userId)) return;
      const user = this.rankingsData.find(r => r.id === userId);
      if (!user) return;
      this.compareUsers.push({ id: userId, name: user.name });
      if (!this.showCompare) this.showCompare = true;
      this._fetchComparePredictions(userId);
    },
    async _fetchComparePredictions(userId) {
      this.compareLoading = { ...this.compareLoading, [userId]: true };
      const errMap = { ...this.compareError };
      delete errMap[userId];
      this.compareError = errMap;
      try {
        const preds = await api.get(`/predictions/compare/${userId}`);
        this.comparePredictions = { ...this.comparePredictions, [userId]: preds };
      } catch (e) {
        const errMap2 = { ...this.compareError };
        errMap2[userId] = e?.message || 'Error al cargar';
        this.compareError = errMap2;
      } finally {
        this.compareLoading = { ...this.compareLoading, [userId]: false };
      }
    },
    retryCompareUser(userId) { this._fetchComparePredictions(userId); },
    removeCompareUser(idx) {
      const u = this.compareUsers[idx];
      if (!u) return;
      this.compareUsers.splice(idx, 1);
      const newPreds = { ...this.comparePredictions };
      delete newPreds[u.id];
      this.comparePredictions = newPreds;
      const newLoading = { ...this.compareLoading };
      delete newLoading[u.id];
      this.compareLoading = newLoading;
      const newErr = { ...this.compareError };
      delete newErr[u.id];
      this.compareError = newErr;
      if (this.compareUsers.length === 0) this.showCompare = false;
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
    },
    clearCompare() {
      this.showCompare = false;
      this.compareUsers = [];
      this.comparePredictions = {};
      this.compareLoading = {};
      this.compareError = {};
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
    },
    _onDarkModeChange() {
      if (this._chart) { this._chart.dispose(); this._chart = null; }
      this.$nextTick(() => this.compareTab === 'race' ? this.renderRace() : this.renderChart());
    },
  },
  watch: {
    compareChartData: {
      handler() { this.$nextTick(() => this.compareTab === 'race' ? this.renderRace() : this.renderChart()); },
      deep: true
    },
    compareTab(val, oldVal) {
      if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
      if (oldVal === 'chart' || oldVal === 'race') {
        if (this._chart) { this._chart.dispose(); this._chart = null; }
      }
      if (val === 'chart' || val === 'race') this.$nextTick(() => val === 'race' ? this.renderRace() : this.renderChart());
    }
  },
  mounted() {
    window.addEventListener('dark-mode-change', this._onDarkModeChange);
  },
  unmounted() {
    if (this._chart) { this._chart.dispose(); this._chart = null; }
    if (this.raceTimer) { clearTimeout(this.raceTimer); this.raceTimer = null; }
    window.removeEventListener('dark-mode-change', this._onDarkModeChange);
  },
  template: `
    <div class="view-container">
      <div class="section-banner">
        <span class="banner-icon">🏆</span>
        <div>
          <h2 class="banner-title">RANKING</h2>
          <p class="banner-subtitle">Tabla de posiciones generales acumuladas del torneo.</p>
        </div>
      </div>

      <div class="ranking-stats-grid">
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box dark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;"><path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" /></svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">PARTICIPANTES</div>
            <div class="ranking-stat-value">{{ rankingsData.length }}</div>
          </div>
        </div>
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;"><path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM6.75 6a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75V6ZM6.75 1.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75V1.5ZM18.75 5.25h.75A2.25 2.25 0 0 1 21.75 7.5v12.75A2.25 2.25 0 0 1 19.5 22.5h-15a2.25 2.25 0 0 1-2.25-2.25V7.5A2.25 2.25 0 0 1 4.5 5.25h.75V3.75a2.25 2.25 0 0 1 4.5 0v1.5H14.25V3.75a2.25 2.25 0 0 1 4.5 0v1.5ZM5.25 8.25v12h13.5v-12H5.25Z" /></svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">PARTIDOS</div>
            <div class="ranking-stat-value">{{ totalMatches }}</div>
          </div>
        </div>
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">JUGADOS</div>
            <div class="ranking-stat-value">{{ playedMatches }}</div>
          </div>
        </div>
      </div>

      <div class="ranking-info-msg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ranking-info-icon-svg"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836c-.149.598.019 1.452.385 1.266 1.144-.573 2.438.463 2.127 1.706l-.71 2.836c-.147.59-.011 1.45.387 1.252a1.125 1.125 0 1 0-1.006-2.012l.709-2.836c.149-.598-.019-1.452-.385-1.266-1.144.573-2.438-.463-2.127-1.706l.71-2.836c.147-.59.011-1.45-.387-1.252a1.125 1.125 0 0 0 1.006 2.012ZM12 9a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" /></svg>
        <span>El ranking se actualiza automáticamente después de cada partido.</span>
      </div>

      <div class="champion-legend" data-dark-text="gray">
        <span style="font-weight:800;">PRONÓSTICO CAMPEÓN:</span>
        <span class="champion-legend-item"><span class="champion-legend-swatch alive"></span><span>Sigue en carrera</span></span>
        <span class="champion-legend-item"><span class="champion-legend-swatch eliminated"></span><span>Ya fue eliminado</span></span>
        <span class="champion-legend-item"><span class="champion-legend-swatch winner"></span><span>¡Es el campeón!</span></span>
      </div>

      <!-- 🔍 Comparación -->
      <div class="card" style="margin-bottom:0.75rem;padding:0.5rem 0.75rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <span data-dark-text="text" style="font-weight:700;font-size:0.7rem;white-space:nowrap;">🔍 COMPARAR</span>
          <span v-for="(u, idx) in compareUsers" :key="u.id" :style="{background:compareColors[idx]+'22',border:'1px solid '+compareColors[idx],padding:'0.15rem 0.4rem',borderRadius:'4px',fontWeight:600,fontSize:'0.65rem',color:compareColors[idx],display:'inline-flex',alignItems:'center',gap:'4px'}">
            <span v-if="compareLoading[u.id]" class="compare-spinner" :style="{display:'inline-block',width:'8px',height:'8px',border:'2px solid '+compareColors[idx],borderTopColor:'transparent',borderRadius:'50%',animation:'compareSpin 0.7s linear infinite'}"></span>
            <span v-else-if="compareError[u.id]" title="Error al cargar" style="cursor:pointer;color:#ef4444;font-weight:700;" @click.stop="retryCompareUser(u.id)">⚠</span>
            <span v-else>✓</span>
            {{ u.name }}
            <span @click="removeCompareUser(idx)" style="cursor:pointer;margin-left:2px;font-weight:700;">✕</span>
          </span>
          <select v-if="compareUsers.length < 4" @change="e => { if(e.target.value) addCompareUser(e.target.value); if(e.target) e.target.value=''; }" data-dark-bg="card" data-dark-border="border" data-dark-text="text" style="flex:1;min-width:100px;padding:0.25rem;border:1px solid #d1d5db;border-radius:4px;font-size:0.7rem;">
            <option value="">+ Agregar</option>
            <option v-for="r in rankingsWithPrize" :key="r.id" :value="r.id" :disabled="compareUsers.find(u=>u.id===r.id)">{{ r.name }}</option>
          </select>
          <span v-if="compareUsers.length > 0" @click="clearCompare" style="cursor:pointer;font-size:0.8rem;color:#ef4444;font-weight:700;">✕ Limpiar</span>
        </div>
        <div v-if="compareLoadingCount > 0" data-dark-text="text" style="margin-top:0.4rem;padding:0.35rem 0.5rem;background:#f1f5f9;border-radius:4px;font-size:0.65rem;display:flex;align-items:center;gap:0.4rem;color:var(--color-dark);">
          <span class="compare-spinner" style="display:inline-block;width:10px;height:10px;border:2px solid var(--color-dark);border-top-color:transparent;border-radius:50%;animation:compareSpin 0.7s linear infinite;"></span>
          <span>Cargando datos de {{ compareLoadingCount }} participante{{ compareLoadingCount > 1 ? 's' : '' }}…</span>
        </div>
        <div v-if="compareErrorUsers.length > 0" data-dark-text="text" style="margin-top:0.4rem;padding:0.35rem 0.5rem;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;font-size:0.65rem;color:#991b1b;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
          <span style="font-weight:700;">⚠</span>
          <span>No se pudieron cargar datos de {{ compareErrorUsers.map(u => u.name).join(', ') }}.</span>
          <button v-for="u in compareErrorUsers" :key="'retry-'+u.id" @click="retryCompareUser(u.id)" style="padding:0.15rem 0.4rem;background:white;border:1px solid #fca5a5;border-radius:3px;font-size:0.6rem;font-weight:700;cursor:pointer;color:#991b1b;">Reintentar {{ u.name }}</button>
        </div>
        <div v-if="compareReady && compareAllLoaded" style="display:flex;gap:0.35rem;margin-top:0.5rem;">
          <button @click="compareTab='table'" :class="compareTab==='table' ? 'compare-tab-active' : 'compare-tab'" data-dark-bg="subtle" :style="{flex:1,padding:'0.25rem',border:'none',borderRadius:'4px',fontWeight:700,fontSize:'0.65rem',cursor:'pointer',background:compareTab==='table'?'var(--color-dark)':'#f1f5f9',color:compareTab==='table'?'white':'var(--color-dark)'}">📋 TABLA</button>
          <button @click="compareTab='chart'" :class="compareTab==='chart' ? 'compare-tab-active' : 'compare-tab'" data-dark-bg="subtle" :style="{flex:1,padding:'0.25rem',border:'none',borderRadius:'4px',fontWeight:700,fontSize:'0.65rem',cursor:'pointer',background:compareTab==='chart'?'var(--color-dark)':'#f1f5f9',color:compareTab==='chart'?'white':'var(--color-dark)'}">📈 GRÁFICO</button>
          <button @click="compareTab='race'" :class="compareTab==='race' ? 'compare-tab-active' : 'compare-tab'" data-dark-bg="subtle" :style="{flex:1,padding:'0.25rem',border:'none',borderRadius:'4px',fontWeight:700,fontSize:'0.65rem',cursor:'pointer',background:compareTab==='race'?'var(--color-dark)':'#f1f5f9',color:compareTab==='race'?'white':'var(--color-dark)'}">🏁 BAR RACE</button>
        </div>
        <div v-if="compareTab==='table' && compareHistory.length && compareAllLoaded" style="max-height:240px;overflow-y:auto;margin-top:0.35rem;">
          <table style="width:100%;border-collapse:collapse;font-size:0.6rem;">
            <thead><tr data-dark-bg="card" data-dark-border="border" style="border-bottom:1px solid #e2e8f0;position:sticky;top:0;background:white;">
              <th data-dark-text="text" style="padding:0.2rem;text-align:left;">Partido</th>
              <th v-for="(u, idx) in compareUsers" :key="u.id" :style="{padding:'0.2rem',textAlign:'center',color:compareColors[idx]}">{{ u.name }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="row in compareHistory" :key="row.match.id" data-dark-border="border" style="border-bottom:1px solid rgba(0,0,0,0.04);">
                <td data-dark-text="text" style="padding:0.15rem 0.2rem;white-space:nowrap;">{{ row.match.home_team }}-{{ row.match.away_team }}</td>
                <td v-for="(u, idx) in compareUsers" :key="u.id" data-dark-text="text" style="padding:0.15rem 0.2rem;text-align:center;font-weight:600;">{{ row.users[u.id] ? row.users[u.id].home+'-'+row.users[u.id].away+' ('+row.users[u.id].pts+'pts)' : '-' }}</td>
              </tr>
              <tr style="font-weight:800;border-top:2px solid var(--color-dark);">
                <td data-dark-text="text" style="padding:0.15rem 0.2rem;">TOTAL</td>
                <td v-for="(u, idx) in compareUsers" :key="u.id" :style="{padding:'0.15rem 0.2rem',textAlign:'center',color:compareColors[idx]}">{{ compareHistory.reduce((s,r) => s + (r.users[u.id]?.pts||0), 0) }} pts</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="(compareTab==='chart' || compareTab==='race') && compareChartData.length && compareAllLoaded" style="width:100%;overflow-x:auto;margin-top:0.35rem;"><div ref="chartContainer" style="min-width:300px;height:220px;"></div></div>
        <div v-if="compareUsers.length > 0 && !compareReady" style="margin-top:0.35rem;font-size:0.65rem;color:var(--color-gray);text-align:center;">Seleccioná al menos 2 participantes</div>
      </div>

      <div class="desktop-grid">
        <div class="main-content-flow">
          <div class="card" style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead data-dark-bg="subtle" style="background: rgba(0,0,0,0.05);">
                <tr>
                  <th data-dark-text="gray" style="padding: 0.5rem; text-align: left; font-size: 0.65rem;">#</th>
                  <th data-dark-text="gray" style="padding: 0.5rem; text-align: left; font-size: 0.65rem;">PARTICIPANTE</th>
                  <th data-dark-text="gray" style="padding: 0.5rem; text-align: right; font-size: 0.65rem;">PREMIO</th>
                  <th data-dark-text="gray" style="padding: 0.5rem; text-align: right; font-size: 0.65rem;">PTS</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(r, i) in rankingsWithPrize" :key="r ? r.id : i">
                <tr data-dark-border="border" style="border-bottom: 1px solid rgba(0,0,0,0.05); cursor:pointer;" @click="r && toggleUser(r.id)">
                  <td data-dark-text="gray" style="padding: 0.5rem; font-size: 0.8rem; color: var(--color-gray); font-weight: 700;">{{ i + 1 }}</td>
                  <td style="padding: 0.5rem; line-height: 1.3;">
                      <div data-dark-text="text" style="font-weight: 600; font-size: 0.85rem; display:flex; align-items:center; gap:0.25rem; flex-wrap:wrap;">
                        <span>{{ r.name }}</span>
                        <span v-for="i in (r.comodines_usados || 0)" :key="'c'+i" style="font-size:0.75rem;" title="Comodín usado">🍀</span>
                        <span v-if="r.champion_pick" class="champion-pick-badge" :class="r.champion_status" :title="championTooltip(r)">
                          <span class="champion-pick-icon">{{ championIcon(r.champion_status) }}</span>
                          <span class="champion-pick-flag">{{ r.champion_flag }}</span>
                          <span class="champion-pick-name">{{ r.champion_pick }}</span>
                        </span>
                      </div>
                    <div data-dark-text="gray" style="font-size: 0.55rem; color: var(--color-gray); opacity: 0.45;">{{ r.email }}</div>
                  </td>
                  <td style="padding: 0.5rem; text-align: right; font-weight: 700; font-size: 0.7rem; white-space: nowrap;" v-if="r.prize"><span :style="{ color: r.prize.color }">{{ r.prize.label }}</span></td>
                  <td data-dark-text="gray" style="padding: 0.5rem; text-align: right; font-size: 0.7rem; color: #ccc;" v-else>-</td>
                  <td data-dark-text="text" style="padding: 0.5rem; text-align: right; font-weight: bold; font-size: 1rem; white-space: nowrap;">{{ r.points }}<span v-if="r.potential_points > 0" class="pts-potential-rank">+{{ r.potential_points }}</span></td>
                </tr>
                <tr v-if="r && expandedUser === r.id">
                  <td colspan="4" style="padding: 0.5rem 0.5rem 0.5rem;">
                    <template v-if="userBreakdown">
                    <div style="width:100%;text-align:right;">
                      <div data-dark-text="text" style="font-size:0.7rem;font-weight:700;color:var(--color-dark);margin-bottom:0.3rem;">Total: <span style="color:var(--color-green);">{{ userBreakdown.exactoPts + userBreakdown.resultadoPts + userBreakdown.champBonus }} pts</span>
                        ({{ userBreakdown.exactoPts }}{{ userBreakdown.resultadoPts > 0 ? ' + ' + userBreakdown.resultadoPts : '' }}<span v-if="userBreakdown.champBonus > 0"> + {{ userBreakdown.champBonus }} 🏆</span>)
                      </div>
                      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;font-size:0.75rem;justify-content:flex-end;">
                        <span v-if="userBreakdown.exactos > 0" @click="toggleStat('exact')" class="breakdown-pill breakdown-exact" style="cursor:pointer;background:#f0fdf4;color:#16a34a;border:1px solid #dcfce7;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;transition:all 0.15s;" :style="statFilter === 'exact' ? 'box-shadow:0 0 0 2px #16a34a;' : ''">{{ userBreakdown.exactos }}× Exacto ({{ userBreakdown.exactoPts }}pts)</span>
                        <span v-if="userBreakdown.resultados > 0" @click="toggleStat('result')" class="breakdown-pill breakdown-result" style="cursor:pointer;background:#fefce8;color:#ca8a04;border:1px solid #fef3c7;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;transition:all 0.15s;" :style="statFilter === 'result' ? 'box-shadow:0 0 0 2px #ca8a04;' : ''">{{ userBreakdown.resultados }}× Resultado ({{ userBreakdown.resultadoPts }}pts)</span>
                        <span v-if="userBreakdown.errors > 0" @click="toggleStat('wrong')" class="breakdown-pill breakdown-wrong" style="cursor:pointer;background:#fef2f2;color:#ef4444;border:1px solid #fee2e2;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;transition:all 0.15s;" :style="statFilter === 'wrong' ? 'box-shadow:0 0 0 2px #ef4444;' : ''">{{ userBreakdown.errors }}× Error (0pts)</span>
                        <span v-if="userBreakdown.pendientes > 0" @click="toggleStat('pendientes')" class="breakdown-pill breakdown-pendiente" style="cursor:pointer;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;transition:all 0.15s;" :style="statFilter === 'pendientes' ? 'box-shadow:0 0 0 2px #475569;' : ''">⏳ {{ userBreakdown.pendientes }} Pendiente<span v-if="userBreakdown.pendientes > 1">s</span></span>
                      </div>
                    </div>
                    <div v-if="statFilter && getStatMatches(statFilter).length > 0" data-dark-border="border" style="width:100%;display:flex;flex-wrap:wrap;gap:0.3rem;justify-content:flex-end;margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid #e2e8f0;">
                      <div v-for="({match, pred, comodin}) in getStatMatches(statFilter)" :key="match.id" class="breakdown-match-card" data-dark-bg="card" data-dark-border="border" :style="(comodin || isFinalWin(match, pred)) ? 'position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:6px;padding:0.3rem 0.4rem 0.3rem 1.5rem;text-align:center;width:130px;box-shadow:0 0 12px rgba(245,158,11,0.5);animation:comodinPulse 1.8s ease-in-out infinite;' : 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:white;border:1px solid rgba(0,0,0,0.07);border-radius:6px;padding:0.3rem 0.4rem;text-align:center;width:120px;'">
                        <span v-if="comodin" style="position:absolute;top:50%;left:4px;transform:translateY(-50%);font-size:0.95rem;filter:drop-shadow(0 0 4px rgba(245,158,11,0.8));animation:comodinSpin 3s linear infinite;">🍀</span>
                        <span v-else-if="isFinalWin(match, pred)" style="position:absolute;top:50%;left:4px;transform:translateY(-50%);font-size:0.95rem;filter:drop-shadow(0 0 4px rgba(212,175,55,0.9));animation:comodinSpin 3s linear infinite;">🏆</span>
                        <template v-if="statFilter === 'exact'">
                          <div data-dark-text="text" style="font-weight:700;font-size:0.75rem;white-space:nowrap;"><img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:14px;height:10px;border-radius:2px;vertical-align:middle;"> {{ match.home_score }}-{{ match.away_score }} <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:14px;height:10px;border-radius:2px;vertical-align:middle;"></div>
                        </template>
                        <template v-else-if="statFilter === 'pendientes'">
                          <div data-dark-text="text" style="font-weight:800;font-size:0.85rem;white-space:nowrap;">{{ pred.home }}-{{ pred.away }}</div>
                          <div data-dark-text="gray" style="font-size:0.55rem;font-weight:600;margin-top:1px;">⏳ {{ match.date }} {{ match.time }}</div>
                        </template>
                        <template v-else>
                          <div style="font-weight:600;font-size:0.65rem;white-space:nowrap;color:var(--color-gray);">👤 {{ pred.home }}-{{ pred.away }}</div>
                          <div data-dark-text="text" style="font-weight:700;font-size:0.75rem;white-space:nowrap;margin-top:1px;"><img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:14px;height:10px;border-radius:2px;vertical-align:middle;"> {{ match.home_score }}-{{ match.away_score }} <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:14px;height:10px;border-radius:2px;vertical-align:middle;"></div>
                        </template>
                        <div data-dark-text="gray" style="font-size:0.55rem;color:var(--color-gray);font-weight:600;margin-top:2px;">{{ match.home_team }} vs {{ match.away_team }}</div>
                      </div>
                    </div>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="sticky-sidebar">
          <div class="card recuerda-card" style="margin-top: 0; background: var(--color-dark); color: white; display: flex; gap: 1rem; align-items: center;">
             <span style="font-size: 1.5rem;">⭐</span>
             <div style="font-size: 0.75rem; line-height: 1.4;">
               <strong>RECUERDA</strong><br>
               +3 PUNTOS por acertar el Score Exacto.<br>
               +1 PUNTO por acertar el Resultado (Gana, Pierde o Empate).
             </div>
          </div>
          <div class="card premios-card" style="background: #fefce8; border: 1px solid #fde68a; color: #92400e; font-size: 0.75rem; line-height: 1.5;">
            <strong style="display:block;margin-bottom:0.35rem;">🏆 PREMIOS</strong>
            <div><span style="color:#f59e0b;font-weight:700;">●</span> 1ro — 45%</div>
            <div><span style="color:#6b7280;font-weight:700;">●</span> 2do — 25%</div>
            <div><span style="color:#b45309;font-weight:700;">●</span> 3ro — 15%</div>
            <div><span style="color:#3b82f6;font-weight:700;">●</span> 4to — 10%</div>
            <div><span style="color:#10b981;font-weight:700;">●</span> 5to — 5%</div>
            <div style="margin-top:0.35rem;border-top:1px solid #fde68a;padding-top:0.35rem;"><strong>Empates:</strong> si dos o más personas tienen los mismos puntos, el premio se divide en partes iguales.</div>
          </div>
        </div>
      </div>
    </div>
  `
};
