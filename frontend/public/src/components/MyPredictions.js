import { roundLabel, formatDate } from '../utils/helpers.js';

export default {
  props: ['matchGroups', 'predictions', 'allMatches', 'championPick'],
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
      return matchPts + (this.championPoints || 0);
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
      // predicted but 0 pts OR predicted but match not finished yet
      const total = this.totalAvailable;
      if (total === 0) return 0;
      return this.allMatches.filter(m => {
        const p = this.predictions[m.id];
        if (!p?.id) return false;
        if (m.status === 'finished') {
          return p.points === 0;
        }
        // predicted but match is closed/past (not yet finished)
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

      <!-- Estadísticas -->
      <div class="card" style="margin-bottom: 1rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <span style="font-size:1.2rem;">📊</span>
          <span style="font-weight:700;font-size:0.8rem;text-transform:uppercase;">ESTADÍSTICAS</span>
        </div>
        <div v-if="totalAvailable === 0" style="text-align:center;padding:0.5rem;font-size:0.75rem;color:var(--color-gray);">
          Aún no hay datos. Aparecerán cuando finalicen los primeros partidos.
        </div>
        <div v-else style="display:flex;flex-direction:column;gap:0.5rem;">
          <!-- Total Points + Partidos -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div style="background:linear-gradient(135deg,#f8f6f2,#f0ede5);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid #e2dcc8;">
              <div style="font-family:var(--font-header);font-size:1.6rem;color:var(--color-dark);">{{ totalPoints }}</div>
              <div style="font-size:0.6rem;color:var(--color-gray);font-weight:600;">TOTAL PUNTOS</div>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:0.7rem;text-align:center;border:1px solid #e2e8f0;">
              <div style="font-family:var(--font-header);font-size:1.6rem;color:var(--color-dark);">{{ totalPredicted }}/{{ totalAvailable }}</div>
              <div style="font-size:0.6rem;color:var(--color-gray);font-weight:600;">PRONOSTICADOS</div>
            </div>
          </div>
          <!-- 4 categorías: Exactos | Resultado | Sin pts | Sin pronóstico -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
            <div style="background:#f0fdf4;border-radius:8px;padding:0.5rem;text-align:center;">
              <div style="font-family:var(--font-header);font-size:1.1rem;color:var(--color-green);">{{ exactCount }}/{{ totalAvailable }}</div>
              <div style="font-size:0.55rem;color:var(--color-gray);">Exacto</div>
              <div style="font-size:0.65rem;font-weight:700;color:var(--color-green);">{{ totalAvailable > 0 ? Math.round(exactCount / totalAvailable * 100) : 0 }}%</div>
            </div>
            <div style="background:#fefce8;border-radius:8px;padding:0.5rem;text-align:center;">
              <div style="font-family:var(--font-header);font-size:1.1rem;color:#ca8a04;">{{ resultCount }}/{{ totalAvailable }}</div>
              <div style="font-size:0.55rem;color:var(--color-gray);">Resultado</div>
              <div style="font-size:0.65rem;font-weight:700;color:#ca8a04;">{{ totalAvailable > 0 ? Math.round(resultCount / totalAvailable * 100) : 0 }}%</div>
            </div>
            <div style="background:#fef2f2;border-radius:8px;padding:0.5rem;text-align:center;">
              <div style="font-family:var(--font-header);font-size:1.1rem;color:#ef4444;">{{ sinPuntosCount }}/{{ totalAvailable }}</div>
              <div style="font-size:0.55rem;color:var(--color-gray);">Sin puntos</div>
              <div style="font-size:0.65rem;font-weight:700;color:#ef4444;">{{ totalAvailable > 0 ? Math.round(sinPuntosCount / totalAvailable * 100) : 0 }}%</div>
            </div>
            <div style="background:#f1f5f9;border-radius:8px;padding:0.5rem;text-align:center;">
              <div style="font-family:var(--font-header);font-size:1.1rem;color:var(--color-gray);">{{ noPredCount }}/{{ totalAvailable }}</div>
              <div style="font-size:0.55rem;color:var(--color-gray);">Sin pronóstico</div>
              <div style="font-size:0.65rem;font-weight:700;color:var(--color-gray);">{{ totalAvailable > 0 ? Math.round(noPredCount / totalAvailable * 100) : 0 }}%</div>
            </div>
          </div>
          <!-- Champion pick -->
          <div v-if="championName" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:0.5rem;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <span>🏆</span>
              <span style="font-size:0.7rem;font-weight:600;">Campeón: <span style="color:var(--color-green);">{{ championName }}</span></span>
            </div>
            <span v-if="champPoints > 0" style="font-size:0.7rem;font-weight:700;color:var(--color-green);">+{{ champPoints }} pts</span>
          </div>
        </div>
      </div>

      <div style="height:0.75rem;"></div>

      <div v-for="group in matchGroups" :key="group.date" class="date-section">
         <div class="date-header">
           <span>{{ formatDate(group.date) }}</span>
           <span v-if="groupPoints(group) > 0" class="pts-total">{{ groupPoints(group) }} PTS</span>
         </div>
         <div v-for="match in group.matches" :key="match.id" class="card" style="margin-bottom: 0.5rem;">
            <div class="match-row" style="border: none;">
               <div class="team-info home">
                  <span class="team-name">{{ match.home_team }}</span>
                  <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="team-flag">
                  <span v-else class="team-flag">{{ match.home_flag }}</span>
               </div>
               
               <div class="score-box">
                  <span class="stat-value" style="font-size: 1.2rem;">{{ predictions[match.id]?.home ?? '-' }}</span>
                  <span>-</span>
                  <span class="stat-value" style="font-size: 1.2rem;">{{ predictions[match.id]?.away ?? '-' }}</span>
               </div>

               <div class="team-info away">
                  <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="team-flag">
                  <span v-else class="team-flag">{{ match.away_flag }}</span>
                  <span class="team-name">{{ match.away_team }}</span>
               </div>
            </div>
              <div v-if="match.status === 'finished'" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.8rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem;">
                 <span style="color: var(--color-gray);">Resultado: {{ match.home_score }} - {{ match.away_score }}</span>
                 <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
                 <span v-else class="pts-badge wrong">0 PTS</span>
              </div>
         </div>
      </div>
    </div>
  `
};
