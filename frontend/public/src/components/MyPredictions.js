import { roundLabel, formatDate } from '../utils/helpers.js';
import { api } from '../services/api.js';

export default {
  props: ['matchGroups', 'predictions', 'allMatches', 'championPick'],
  data() { return { statsExpanded: true, statsObserver: null, expandedMatch: null, matchStats: null, expandedTopScore: null, selectedDate: '', showDatePicker: false, calendarYear: 0, calendarMonth: 0, months: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] }; },
  mounted() {
    this.$nextTick(() => {
      const el = this.$refs?.statsContainer;
      if (el && typeof IntersectionObserver !== 'undefined') {
        this.statsObserver = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting && this.statsExpanded) {
            this.statsExpanded = false;
          }
        }, { threshold: 0 });
        this.statsObserver.observe(el);
      }
    });
  },
  unmounted() {
    if (this.statsObserver) { this.statsObserver.disconnect(); this.statsObserver = null; }
  },
  computed: {
    totalAvailable() {
      return this.allMatches.filter(m => {
        if (m.status === 'finished' || m.status === 'closed') return true;
        if (m.status === 'open') {
          const matchDt = m.date + ' ' + (m.time || '00:00');
          const now = new Date();
          const nowStr = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
          return matchDt < nowStr;
        }
        return false;
      }).length;
    },
    totalPredicted() {
      return this.allMatches.filter(m => {
        if (!this.predictions[m.id]?.id) return false;
        if (m.status === 'finished' || m.status === 'closed') return true;
        if (m.status === 'open') {
          const matchDt = m.date + ' ' + (m.time || '00:00');
          const now = new Date();
          const nowStr = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
          return matchDt < nowStr;
        }
        return false;
      }).length;
    },
    totalPoints() {
      const matchPts = this.allMatches.reduce((sum, m) => {
        if (m.status !== 'finished') return sum;
        const p = this.predictions[m.id];
        if (!p?.id || p.points == null) return sum;
        return sum + p.points;
      }, 0);
      return matchPts + (this.champPoints || 0);
    },
    champPoints() {
      return this.championPick?.points || 0;
    },
    championName() {
      return this.championPick?.champion || '';
    },
    exactCount() {
      const total = this.totalAvailable;
      if (total === 0) return 0;
      return this.allMatches.filter(m => {
        if (m.status !== 'finished') return false;
        const p = this.predictions[m.id];
        return p?.id && p.points != null && p.points >= 3;
      }).length;
    },
    resultCount() {
      const total = this.totalAvailable;
      if (total === 0) return 0;
      return this.allMatches.filter(m => {
        if (m.status !== 'finished') return false;
        const p = this.predictions[m.id];
        return p?.id && p.points != null && p.points > 0 && p.points < 3;
      }).length;
    },
    sinPuntosCount() {
      const total = this.totalAvailable;
      if (total === 0) return 0;
      return this.allMatches.filter(m => {
        const p = this.predictions[m.id];
        if (!p?.id) return false;
        if (m.status === 'finished') {
          return p.points === 0;
        }
        if (m.status === 'closed') return true;
        if (m.status === 'open') {
          const matchDt = m.date + ' ' + (m.time || '00:00');
          const now = new Date();
          const nowStr = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
          return matchDt < nowStr;
        }
        return false;
      }).length;
    },
    noPredCount() {
      return Math.max(0, this.totalAvailable - this.totalPredicted);
    },
    finishedPreds() {
      return this.allMatches
        .filter(m => m.status === 'finished' && this.predictions[m.id]?.id)
        .map(m => ({ match: m, pred: this.predictions[m.id] }))
        .sort((a, b) => (a.match.date + ' ' + a.match.time).localeCompare(b.match.date + ' ' + b.match.time));
    },
    currentStreak() {
      let streak = 0;
      for (let i = this.finishedPreds.length - 1; i >= 0; i--) {
        if (this.finishedPreds[i].pred.points > 0) streak++;
        else break;
      }
      return streak;
    },
    maxStreak() {
      let max = 0, current = 0;
      for (const { pred } of this.finishedPreds) {
        if (pred.points > 0) { current++; max = Math.max(max, current); }
        else current = 0;
      }
      return max;
    },
    availableDates() {
      return this.matchGroups.map(g => g.date);
    },
    filteredGroups() {
      if (!this.selectedDate) return this.matchGroups;
      return this.matchGroups.filter(g => g.date === this.selectedDate);
    },
    availableDateSet() {
      return new Set(this.availableDates);
    },
    calendarDays() {
      const year = this.calendarYear;
      const month = this.calendarMonth;
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ day: d, dateStr, available: this.availableDateSet.has(dateStr) });
      }
      return days;
    }
  },
  methods: {
    formatDate,
    roundLabel,
    getPoints(match) {
      const p = this.predictions[match.id];
      if (!p || match.status !== 'finished') return null;
      return p.points ?? null;
    },
    groupPoints(group) {
      return group.matches.reduce((sum, m) => {
        const pts = this.getPoints(m);
        return pts !== null ? sum + pts : sum;
      }, 0);
    },
    ptsClass(match) {
      const pts = this.getPoints(match);
      if (pts === null) return '';
      if (pts >= 3) return 'exact';
      if (pts > 0) return 'winner';
      return 'wrong';
    },
    toggleDatePicker() {
      this.showDatePicker = !this.showDatePicker;
      if (this.showDatePicker) {
        const d = this.selectedDate ? new Date(this.selectedDate + 'T12:00:00') : new Date();
        this.calendarYear = d.getFullYear();
        this.calendarMonth = d.getMonth();
      }
    },
    prevMonth() {
      if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
      else this.calendarMonth--;
    },
    nextMonth() {
      if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
      else this.calendarMonth++;
    },
    pickDate(dateStr) {
      this.selectedDate = dateStr;
      this.showDatePicker = false;
    },
    toggleMatchStats(matchId) {
      if (this.expandedMatch === matchId) { this.expandedMatch = null; this.matchStats = null; this.expandedTopScore = null; return; }
      api.get(`/predictions/match/${encodeURIComponent(matchId)}`).then(r => {
        const home = r.filter(p => Number(p.home_score) > Number(p.away_score)).length;
        const draw = r.filter(p => Number(p.home_score) === Number(p.away_score)).length;
        const away = r.filter(p => Number(p.home_score) < Number(p.away_score)).length;
        const top = Object.entries(r.reduce((a, p) => { const k = p.home_score+'-'+p.away_score; a[k]=(a[k]||0)+1; return a; }, {})).sort((a,b)=>b[1]-a[1]);
        this.matchStats = { total: r.length, homeWins: home, draws: draw, awayWins: away, topScores: top, predictions: r };
        this.expandedTopScore = null;
        this.expandedMatch = matchId;
      }).catch(() => { this.matchStats = {total:0, predictions: []}; this.expandedMatch = matchId; });
    },
    getUsersForScore(score) {
      if (!this.matchStats || !this.matchStats.predictions) return [];
      return this.matchStats.predictions.filter(p => `${p.home_score}-${p.away_score}` === score);
    },
    toggleTopScore(score) {
      this.expandedTopScore = this.expandedTopScore === score ? null : score;
    }
  },
  template: `
    <div class="view-container">
      <div class="section-banner">
        <span class="banner-icon">📋</span>
        <div>
          <h2 class="banner-title">MIS PRONÓSTICOS</h2>
          <p class="banner-subtitle">Revisa el historial de tus pronósticos y los puntos obtenidos.</p>
        </div>
      </div>

      <!-- Estadísticas (Siempre Arriba) -->
      <div ref="statsContainer" class="card" style="margin-bottom: 1rem; padding: 0;">
        <div @click="statsExpanded = !statsExpanded" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;user-select:none;padding:0.75rem 1rem;border-radius:8px;background:#f1f5f9;transition:background 0.2s;" @mouseover="$event.currentTarget.style.background='#e2e8f0'" @mouseout="$event.currentTarget.style.background='#f1f5f9'">
          <span style="font-size:1rem;">📊</span>
          <span style="font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.03em;flex:1;">ESTADÍSTICAS</span>
          <span style="font-size:0.7rem;color:#64748b;font-weight:700;transition:transform 0.2s;" :style="{ transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }">▼</span>
        </div>
          <Transition name="fade">
            <div v-show="statsExpanded" style="padding:0.65rem 1rem 1rem;">
              <div v-if="totalAvailable === 0" style="text-align:center;padding:0.5rem;font-size:0.75rem;color:var(--color-gray);">
                Aún no hay datos. Aparecerán cuando finalicen los primeros partidos.
              </div>
              <div v-else>
                <div class="stat-grid">
                  <div class="stat-card primary">
                    <div class="stat-card-value">{{ totalPoints }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Puntos</span>
                    </div>
                  </div>
                  <div class="stat-card predicted">
                    <div class="stat-card-value">{{ totalPredicted }}/{{ totalAvailable }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Pronosticados</span>
                    </div>
                  </div>
                  <div class="stat-card exact">
                    <div class="stat-card-value">{{ exactCount }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Exactos</span>
                      <span class="stat-card-pct exact">{{ totalAvailable > 0 ? Math.round(exactCount / totalAvailable * 100) : 0 }}%</span>
                    </div>
                  </div>
                  <div class="stat-card result">
                    <div class="stat-card-value">{{ resultCount }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Resultado</span>
                      <span class="stat-card-pct result">{{ totalAvailable > 0 ? Math.round(resultCount / totalAvailable * 100) : 0 }}%</span>
                    </div>
                  </div>
                  <div class="stat-card wrong">
                    <div class="stat-card-value">{{ sinPuntosCount }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Sin puntos</span>
                      <span class="stat-card-pct wrong">{{ totalAvailable > 0 ? Math.round(sinPuntosCount / totalAvailable * 100) : 0 }}%</span>
                    </div>
                  </div>
                  <div class="stat-card none">
                    <div class="stat-card-value">{{ noPredCount }}</div>
                    <div class="stat-card-footer">
                      <span class="stat-card-label">Sin pred.</span>
                      <span class="stat-card-pct none">{{ totalAvailable > 0 ? Math.round(noPredCount / totalAvailable * 100) : 0 }}%</span>
                    </div>
                  </div>
                  <div v-if="championName" style="grid-column: 1 / -1; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:0.5rem 0.7rem; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                      <span style="font-size:1rem;">🏆</span>
                      <span style="font-size:0.7rem;font-weight:600;color:#166534;">Campeón: <span style="font-weight:800;color:var(--color-green);">{{ championName }}</span></span>
                    </div>
                    <span v-if="champPoints > 0" style="font-size:0.7rem;font-weight:800;color:var(--color-green);">+{{ champPoints }} pts</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
      </div>

      <!-- Filtro por fecha -->
      <div class="card" style="margin-bottom: 0.75rem; padding: 0.65rem 1rem;">
        <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
          <span style="font-size:0.75rem;font-weight:700;">📅</span>
          <button @click="toggleDatePicker" style="flex:1;min-width:140px;padding:0.4rem 0.5rem;border:1.5px solid #e2e8f0;border-radius:8px;font-family:var(--font-main);font-size:0.8rem;background:#f8fafc;cursor:pointer;text-align:left;color:var(--color-dark);">
            {{ selectedDate ? formatDate(selectedDate) : 'Todas las fechas' }}
          </button>
          <button v-if="selectedDate" @click="selectedDate = ''" style="padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.7rem;white-space:nowrap;">✕</button>
        </div>

        <!-- Calendario -->
        <div v-if="showDatePicker" style="margin-top:0.65rem;border:1px solid #e2e8f0;border-radius:10px;padding:0.65rem;background:white;user-select:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
            <button @click="prevMonth" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:0.15rem 0.35rem;color:var(--color-dark);font-weight:700;">‹</button>
            <span style="font-weight:800;font-size:0.85rem;">{{ months[calendarMonth] }} {{ calendarYear }}</span>
            <button @click="nextMonth" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:0.15rem 0.35rem;color:var(--color-dark);font-weight:700;">›</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:0.55rem;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:0.25rem;">
            <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">
            <template v-for="(day, i) in calendarDays" :key="i">
              <div v-if="!day" style="padding:0.3rem 0;"></div>
              <div v-else @click="day.available ? pickDate(day.dateStr) : null" :style="{
                padding:'0.3rem 0',
                fontSize:'0.75rem',
                fontWeight: day.available ? 700 : 400,
                borderRadius:'6px',
                cursor: day.available ? 'pointer' : 'default',
                background: day.dateStr === selectedDate ? 'var(--color-dark)' : day.available ? '#f1f5f9' : 'transparent',
                color: day.dateStr === selectedDate ? 'white' : day.available ? 'var(--color-dark)' : '#d1d5db'
              }">{{ day.day }}</div>
            </template>
          </div>
        </div>
      </div>

      <!-- Historial de Partidos -->
      <div class="main-content-flow">
        <div v-if="filteredGroups.length === 0" class="card" style="text-align:center;padding:2rem;color:var(--color-gray);">
          {{ selectedDate ? 'No hay partidos para esta fecha.' : 'Aún no tienes pronósticos registrados para partidos finalizados o pasados.' }}
        </div>
        <div v-for="group in filteredGroups" :key="group.date" class="date-section">
          <div class="date-header">
            <span>{{ formatDate(group.date) }}</span>
            <span v-if="groupPoints(group) > 0" style="background:var(--color-accent);color:var(--color-dark);padding:0.15rem 0.5rem;border-radius:4px;font-family:var(--font-main);font-size:0.7rem;font-weight:800;letter-spacing:0.03em;">{{ groupPoints(group) }} PTS</span>
            <span v-else-if="group.matches.some(m => m.status === 'finished')" style="background:#e2e8f0;color:#64748b;padding:0.15rem 0.5rem;border-radius:4px;font-family:var(--font-main);font-size:0.7rem;font-weight:700;">0 PTS</span>
          </div>
          <div v-for="match in group.matches" :key="match.id" class="card" style="margin-bottom: 0.5rem;">
            <div class="match-row" style="border: none;">
               <div class="team-info home">
                  <span class="team-name">{{ match.home_team }}</span>
                  <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="team-flag">
                  <span v-else class="team-flag">{{ match.home_flag }}</span>
               </div>

               <div class="score-box">
                  <span class="input-score" style="line-height: 35px; background: #f1f5f9; cursor: default;">{{ predictions[match.id]?.home ?? '-' }}</span>
                  <span>-</span>
                  <span class="input-score" style="line-height: 35px; background: #f1f5f9; cursor: default;">{{ predictions[match.id]?.away ?? '-' }}</span>
               </div>

               <div class="team-info away">
                  <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="team-flag">
                  <span v-else class="team-flag">{{ match.away_flag }}</span>
                  <span class="team-name">{{ match.away_team }}</span>
               </div>
            </div>
            <div v-if="match.status === 'finished'" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);border-radius:6px;padding-left:0.5rem;padding-right:0.5rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1;justify-content:center;">
                <span style="font-size:0.6rem;font-weight:700;color:var(--color-gray);letter-spacing:0.08em;">RESULTADO</span>
                <span style="font-size:1.4rem;font-weight:900;color:var(--color-dark);background:white;padding:0.1rem 0.7rem;border-radius:6px;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.06);">{{ match.home_score }} - {{ match.away_score }}</span>
              </div>
              <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)" style="font-size:0.85rem;">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
              <span v-else class="pts-badge wrong">0 PTS</span>
            </div>
            <button @click="toggleMatchStats(match.id)" style="width:100%;margin-top:0.4rem;padding:0.25rem;border:none;border-radius:4px;background:rgba(0,0,0,0.03);color:var(--color-gray);font-size:0.6rem;cursor:pointer;font-weight:600;transition:background 0.2s;" @mouseover="$event.target.style.background='rgba(0,0,0,0.07)'" @mouseout="$event.target.style.background='rgba(0,0,0,0.03)'">
              👥 {{ expandedMatch === match.id ? 'OCULTAR' : 'VER PRONÓSTICOS' }}
            </button>
            <div v-if="expandedMatch === match.id" style="margin-top:0.4rem;padding:0.5rem;background:#f8fafc;border-radius:6px;font-size:0.7rem;border:1px solid rgba(0,0,0,0.06);">
              <div style="display:flex;gap:0.75rem;margin-bottom:0.5rem;text-align:center;">
                <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;">{{ matchStats?.total ?? 0 }}</div><div style="color:var(--color-gray);font-size:0.6rem;">VOTOS</div></div>
                <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#16a34a;">{{ matchStats?.homeWins ?? 0 }}</div><div style="color:var(--color-gray);font-size:0.6rem;"><img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:14px;height:10px;border-radius:1px;vertical-align:middle;"> GANA</div></div>
                <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#d4af37;">{{ matchStats?.draws ?? 0 }}</div><div style="color:var(--color-gray);font-size:0.6rem;">EMPATE</div></div>
                <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#2563eb;">{{ matchStats?.awayWins ?? 0 }}</div><div style="color:var(--color-gray);font-size:0.6rem;"><img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:14px;height:10px;border-radius:1px;vertical-align:middle;"> GANA</div></div>
              </div>
              <div v-if="matchStats?.topScores?.length" style="border-top:1px solid rgba(0,0,0,0.06);padding-top:0.5rem;">
                <div style="font-size:0.6rem;font-weight:700;color:var(--color-gray);text-align:center;margin-bottom:0.35rem;">PRONÓSTICOS MÁS VOTADOS</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.3rem;">
                  <div v-for="([s, c]) in matchStats.topScores" :key="s" style="display:flex;flex-direction:column;align-items:stretch;background:white;border:1px solid rgba(0,0,0,0.07);border-radius:6px;cursor:pointer;transition:all 0.15s;max-width:130px;overflow:hidden;" :style="expandedTopScore === s ? 'border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,0.2);' : ''" @click="toggleTopScore(s)">
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.4rem 0.3rem;">
                      <div style="font-weight:700;font-size:0.8rem;white-space:nowrap;">
                        <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:16px;height:11px;border-radius:2px;vertical-align:middle;">
                        {{ s }}
                        <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:16px;height:11px;border-radius:2px;vertical-align:middle;">
                      </div>
                      <div style="font-size:0.6rem;color:var(--color-gray);font-weight:600;">{{ c }} voto{{ c !== 1 ? 's' : '' }}</div>
                    </div>
                    <div v-if="expandedTopScore === s" style="background:#f1f5f9;border-top:1px solid rgba(0,0,0,0.07);padding:0.3rem 0.4rem;font-size:0.6rem;color:var(--color-dark);max-height:140px;overflow-y:auto;">
                      <div v-for="p in getUsersForScore(s)" :key="p.id" style="padding:0.15rem 0;border-bottom:1px solid rgba(0,0,0,0.04);">{{ p.expand?.user?.name || p.expand?.user?.email || 'Anónimo' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
