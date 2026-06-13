import { api } from '../services/api.js';

export default {
  props: ['rankingsData', 'rankingsLoading', 'allMatches'],
  data() {
    return { expandedUser: null, userBreakdown: null };
  },
  computed: {
    totalMatches() {
      return this.allMatches.length;
    },
    playedMatches() {
      return this.allMatches.filter(m => m.status === 'finished').length;
    }
  },
  methods: {
    async toggleUser(userId) {
      if (this.expandedUser === userId) {
        this.expandedUser = null;
        this.userBreakdown = null;
        return;
      }
      try {
        const records = await api.get('/predictions/rankings');
        const userPreds = records.filter(r => r.user === userId);
        let exactos = 0, resultados = 0, errors = 0, comodines = 0;
        const matches = this.allMatches.filter(m => m.status === 'finished');
        userPreds.forEach(p => {
          const match = matches.find(m => m.id === p.match);
          if (p.comodin) comodines++;
          if (!match || match.home_score == null) return;
          const ph = Number(p.home_score), pa = Number(p.away_score);
          const mh = Number(match.home_score), ma = Number(match.away_score);
          if (ph === mh && pa === ma) exactos++;
          else {
            const pd = ph - pa;
            const rd = mh - ma;
            if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) resultados++;
            else errors++;
          }
        });
        // Champion bonus
        const champPicks = await api.get('/champion-picks/all').catch(() => []);
        const champPick = champPicks.find(cp => cp.user === userId);
        const champBonus = champPick ? 5 : 0;
        this.userBreakdown = { exactos, resultados, errors, comodines, champBonus };
        this.expandedUser = userId;
      } catch (_) {
        this.userBreakdown = null;
        this.expandedUser = userId;
      }
    }
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

      <!-- Stats Grid -->
      <div class="ranking-stats-grid">
        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box dark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">PARTICIPANTES</div>
            <div class="ranking-stat-value">{{ rankingsData.length }}</div>
          </div>
        </div>

        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM6.75 6a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75V6ZM6.75 1.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75V1.5ZM18.75 5.25h.75A2.25 2.25 0 0 1 21.75 7.5v12.75A2.25 2.25 0 0 1 19.5 22.5h-15a2.25 2.25 0 0 1-2.25-2.25V7.5A2.25 2.25 0 0 1 4.5 5.25h.75V3.75a2.25 2.25 0 0 1 4.5 0v1.5H14.25V3.75a2.25 2.25 0 0 1 4.5 0v1.5ZM5.25 8.25v12h13.5v-12H5.25Z" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">PARTIDOS</div>
            <div class="ranking-stat-value">{{ totalMatches }}</div>
          </div>
        </div>

        <div class="ranking-stat-card">
          <div class="ranking-stat-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px;">
              <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ranking-stat-info">
            <div class="ranking-stat-label">JUGADOS</div>
            <div class="ranking-stat-value">{{ playedMatches }}</div>
          </div>
        </div>
      </div>

      <div class="ranking-info-msg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="ranking-info-icon-svg">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836c-.149.598.019 1.452.385 1.266 1.144-.573 2.438.463 2.127 1.706l-.71 2.836c-.147.59-.011 1.45.387 1.252a1.125 1.125 0 1 0-1.006-2.012l.709-2.836c.149-.598-.019-1.452-.385-1.266-1.144.573-2.438-.463-2.127-1.706l.71-2.836c.147-.59.011-1.45-.387-1.252a1.125 1.125 0 0 0 1.006 2.012ZM12 9a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" />
        </svg>
        <span>El ranking se actualiza automáticamente después de cada partido.</span>
      </div>

      <div class="card" style="padding: 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: rgba(0,0,0,0.05);">
            <tr>
              <th style="padding: 0.5rem; text-align: left; font-size: 0.65rem;">#</th>
              <th style="padding: 0.5rem; text-align: left; font-size: 0.65rem;">PARTICIPANTE</th>
              <th style="padding: 0.5rem; text-align: left; font-size: 0.65rem;">CORREO</th>
              <th style="padding: 0.5rem; text-align: right; font-size: 0.65rem;">PTS</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(r, i) in rankingsData || []" :key="r ? r.id : i">
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.05); cursor:pointer;" @click="r && toggleUser(r.id)">
              <td style="padding: 0.5rem;">
                <span v-if="i === 0">🥇</span>
                <span v-else-if="i === 1">🥈</span>
                <span v-else-if="i === 2">🥉</span>
                <span v-else style="font-size: 0.8rem; color: var(--color-gray); font-weight: 700;">{{ i + 1 }}</span>
              </td>
              <td style="padding: 0.5rem; font-weight: 600; font-size: 0.85rem;">{{ r.name }}</td>
              <td style="padding: 0.5rem; font-size: 0.7rem; color: var(--color-gray);">{{ r.email }}</td>
              <td style="padding: 0.5rem; text-align: right; font-weight: bold; font-size: 1rem; white-space: nowrap;">{{ r.points }}<span v-if="r.potential_points > 0" class="pts-potential-rank">+{{ r.potential_points }}</span></td>
            </tr>
            <tr v-if="r && expandedUser === r.id">
              <td colspan="4" style="padding: 0.5rem 0.5rem 0.5rem;">
                <template v-if="userBreakdown">
                <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end;">
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap;font-size:0.75rem;justify-content:flex-end;">
                    <span style="background:#f0fdf4;color:#16a34a;border:1px solid #dcfce7;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;">{{ userBreakdown.exactos }}× Exacto ({{ userBreakdown.exactos * 3 }}pts)</span>
                    <span style="background:#fefce8;color:#ca8a04;border:1px solid #fef3c7;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;">{{ userBreakdown.resultados }}× Resultado ({{ userBreakdown.resultados * 1 }}pts)</span>
                    <span style="background:#fef2f2;color:#ef4444;border:1px solid #fee2e2;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;">{{ userBreakdown.errors }}× Error (0pts)</span>
                    <span v-if="userBreakdown.comodines > 0" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;">🍀 {{ userBreakdown.comodines }}× Comodín</span>
                    <span v-if="userBreakdown.champBonus > 0" style="background:#fff7ed;color:#d97706;border:1px solid #ffedd5;padding:0.25rem 0.5rem;border-radius:4px;font-weight:700;">🏆 Campeón (+{{ userBreakdown.champBonus }}pts)</span>
                  </div>
                  <div style="font-size:0.7rem;font-weight:700;text-align:right;color:var(--color-dark);border-top:1px solid #e2e8f0;padding-top:0.3rem;width:100%;">
                    Total: <span style="color:var(--color-green);">{{ userBreakdown.exactos * 3 + userBreakdown.resultados * 1 + userBreakdown.champBonus }} pts</span>
                    ({{ userBreakdown.exactos * 3 }}{{ userBreakdown.resultados > 0 ? ' + ' + userBreakdown.resultados : '' }}{{ userBreakdown.champBonus > 0 ? ' + ' + userBreakdown.champBonus + ' (🏆)' : '' }})
                  </div>
                </div>
                </template>
                <div v-else style="font-size:0.6rem;color:var(--color-gray);text-align:center;padding:0.25rem;">
                  ⏳ Cargando detalle...
                </div>
              </td>
            </tr>
            </template>
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
