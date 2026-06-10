export default {
    props: ['rankingsData', 'rankingsLoading'],
    template: `
    <div class="view-container">
      <div class="section-banner">
        <span class="banner-icon">🏆</span>
        <div>
          <h2 class="banner-title">RANKING</h2>
          <p class="banner-subtitle">Tabla de posiciones generales acumuladas del torneo.</p>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <span class="stat-label">Participantes</span>
          <span class="stat-value">{{ rankingsData.length }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Partidos</span>
          <span class="stat-value">104</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Jugados</span>
          <span class="stat-value">48</span>
        </div>
      </div>

      <div class="card" style="padding: 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: rgba(0,0,0,0.05);">
            <tr>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.7rem;">#</th>
              <th style="padding: 0.75rem; text-align: left; font-size: 0.7rem;">PARTICIPANTE</th>
              <th style="padding: 0.75rem; text-align: right; font-size: 0.7rem;">PUNTOS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rankingsData" :key="r.id" style="border-bottom: 1px solid rgba(0,0,0,0.05);">
              <td style="padding: 0.75rem;">
                <span v-if="i === 0">🥇</span>
                <span v-else-if="i === 1">🥈</span>
                <span v-else-if="i === 2">🥉</span>
                <span v-else>{{ i + 1 }}</span>
              </td>
              <td style="padding: 0.75rem; font-weight: 600;">{{ r.name }}</td>
              <td style="padding: 0.75rem; text-align: right; font-weight: bold;">{{ r.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top: 1rem; background: var(--color-dark); color: white; display: flex; gap: 1rem; align-items: center;">
         <span style="font-size: 1.5rem;">⭐</span>
         <div style="font-size: 0.75rem; line-height: 1.4;">
           <strong>RECUERDA</strong><br>
           +3 PUNTOS por acertar el Score Exacto.<br>
           +1 PUNTO por acertar el Resultado (Gana, Pierde o Empate).
         </div>
      </div>
    </div>
  `
};
