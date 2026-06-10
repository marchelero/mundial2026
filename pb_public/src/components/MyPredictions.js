import { roundLabel, formatDate } from '../utils/helpers.js';

export default {
  props: ['matchGroups', 'predictions', 'allMatches'],
  methods: {
    formatDate
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

      <div class="stats-row">
        <div class="stat-box">
          <span class="stat-label">Partidos</span>
          <span class="stat-value">{{ allMatches.length }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Acertados</span>
          <span class="stat-value">12</span>
        </div>
        <div class="stat-box" style="background: var(--color-accent); color: white;">
          <span class="stat-label" style="color: white;">Comodín</span>
          <span class="stat-value">🍀</span>
        </div>
      </div>

      <div v-for="group in matchGroups" :key="group.date" class="date-section">
         <h3 class="form-label">{{ formatDate(group.date) }}</h3>
         <div v-for="match in group.matches" :key="match.id" class="card" style="margin-bottom: 0.5rem;">
            <div class="match-row" style="border: none;">
               <div class="team-info home">
                  <span class="team-name">{{ match.home_team }}</span>
                  <span class="team-flag">{{ match.home_flag }}</span>
               </div>
               
               <div class="score-box">
                  <span class="stat-value" style="font-size: 1.2rem;">{{ predictions[match.id]?.home ?? '-' }}</span>
                  <span>-</span>
                  <span class="stat-value" style="font-size: 1.2rem;">{{ predictions[match.id]?.away ?? '-' }}</span>
               </div>

               <div class="team-info away">
                  <span class="team-flag">{{ match.away_flag }}</span>
                  <span class="team-name">{{ match.away_team }}</span>
               </div>
            </div>
            <div v-if="match.status === 'finished'" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.8rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem;">
               <span style="color: var(--color-gray);">Real: {{ match.home_score }} - {{ match.away_score }}</span>
               <span style="color: var(--color-green); font-weight: bold;">+3 PTS 🍀</span>
            </div>
         </div>
      </div>
    </div>
  `
};
