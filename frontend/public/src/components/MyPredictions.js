import { roundLabel, formatDate, calcPoints } from '../utils/helpers.js';

export default {
  props: ['matchGroups', 'predictions', 'allMatches'],
  computed: {
    totalPredicted() {
      return this.allMatches.filter(m => this.predictions[m.id]?.id).length;
    },
    exactScores() {
      return this.allMatches.filter(m => {
        if (m.status !== 'finished') return false;
        const p = this.predictions[m.id];
        if (!p?.id) return false;
        // Calculate points WITHOUT comodin for the stat count
        const pts = calcPoints({ home_score: p.home, away_score: p.away, comodin: false }, m);
        return pts === 3;
      }).length;
    },
    resultsOnly() {
      return this.allMatches.filter(m => {
        if (m.status !== 'finished') return false;
        const p = this.predictions[m.id];
        if (!p?.id) return false;
        // Calculate points WITHOUT comodin for the stat count
        const pts = calcPoints({ home_score: p.home, away_score: p.away, comodin: false }, m);
        return pts === 1;
      }).length;
    },
    jokersUsed() {
      return Object.values(this.predictions).filter(p => p.comodin).length;
    }
  },
  methods: {
    formatDate,
    getPoints(match) {
      const p = this.predictions[match.id];
      if (!p) return null;
      return calcPoints({ home_score: p.home, away_score: p.away, comodin: p.comodin }, match);
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

      <!-- Stats Summary (Unified with Ranking Style) -->
      <div class="ranking-stats-grid">
        <!-- Partidos -->
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box dark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a7.93 7.93 0 0 1 3.91 1.03l-1.83 1.83a2.5 2.5 0 0 1-4.16 0l-1.83-1.83A7.93 7.93 0 0 1 12 4Zm-6.39 4.91 1.83 1.83a2.5 2.5 0 0 1 0 2.16l-1.83 1.83A7.94 7.94 0 0 1 4 12c0-1.15.24-2.24.61-3.24L4.6 8.91h1.01Zm2.64 4.32 1.83-1.83a2.49 2.49 0 0 1 3.44 0l1.83 1.83-1.83 1.83a2.49 2.49 0 0 1-3.44 0l-1.83-1.83ZM12 20c-1.03 0-2.01-.22-2.91-.61l1.83-1.83a2.5 2.5 0 0 1 2.16 0l1.83 1.83C14.01 19.78 13.03 20 12 20Zm6.39-4.91a7.94 7.94 0 0 1-.61 3.24L15.95 16.5a2.5 2.5 0 0 1 0-2.16l1.83-1.83.61 3.24V15.09h-.1v1Zm-1.83-5.69A2.5 2.5 0 0 1 15.95 11l1.83-1.83c.37 1 .61 2.09.61 3.24 0 .39-.03.77-.09 1.15l-1.83-1.47V10.5h.09l-.17-.18Z" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">PARTIDOS</div>
            <div class="ranking-stat-value">{{ totalPredicted }}</div>
          </div>
        </div>

        <!-- Score Exacto -->
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path fill-rule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v.756a8.25 8.25 0 0 1 7.244 7.244h.756a.75.75 0 0 1 0 1.5h-.756a8.25 8.25 0 0 1-7.244 7.244v.756a.75.75 0 0 1-1.5 0v-.756a8.25 8.25 0 0 1-7.244-7.244h-.756a.75.75 0 0 1 0-1.5h.756a8.25 8.25 0 0 1 7.244-7.244V3a.75.75 0 0 1 .75-.75ZM5.25 12a6.75 6.75 0 1 1 13.5 0 6.75 6.75 0 0 1-13.5 0Zm6.75-4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">SCORE EXACTO <span style="font-size: 0.6rem; opacity: 0.7;">(+3)</span></div>
            <div class="ranking-stat-value">{{ exactScores }}</div>
          </div>
        </div>

        <!-- Resultado -->
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">RESULTADO <span style="font-size: 0.6rem; opacity: 0.7;">(+1)</span></div>
            <div class="ranking-stat-value">{{ resultsOnly }}</div>
          </div>
        </div>

        <!-- Comodin -->
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box" style="color: var(--color-green);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
              <path d="m3.265 10.602 7.691 4.142a2.25 2.25 0 0 0 2.088 0l7.691-4.142a.75.75 0 0 1 .712 1.32l-7.691 4.142a3.75 3.75 0 0 1-3.482 0l-7.691-4.142a.75.75 0 1 1 .712-1.32Z" />
              <path d="m3.265 14.352 7.691 4.142a2.25 2.25 0 0 0 2.088 0l7.691-4.142a.75.75 0 0 1 .712 1.32l-7.691 4.142a3.75 3.75 0 0 1-3.482 0l-7.691-4.142a.75.75 0 1 1 .712-1.32Z" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">COMODÍN</div>
            <div class="ranking-stat-value">{{ jokersUsed }}</div>
          </div>
        </div>
      </div>

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
                <span style="color: var(--color-gray);">Real: {{ match.home_score }} - {{ match.away_score }}</span>
                <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
                <span v-else style="color: var(--color-gray); font-size: 0.7rem;">Sin pronóstico</span>
             </div>
         </div>
      </div>
    </div>
  `
};
