import { roundLabel, formatDate, calcPoints, flagUrl } from '../utils/helpers.js';

export default {
  props: ['matchGroups', 'predictions', 'user', 'saving', 'comodinUsado', 'countries', 'settings', 'championPick'],
  emits: ['set-score', 'toggle-comodin', 'submit', 'save-champion-pick'],
  data() {
    return {
      activeTab: 'HOY',
      championSelected: '',
    };
  },
  computed: {
    championPickOpen() {
      if (this.settings?.champion_pick_open === 'false') return false;
      if (!this.matchGroups || this.matchGroups.length === 0) return true;
      const now = new Date();
      const nowStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      for (const g of this.matchGroups) {
        for (const m of g.matches) {
          const matchDt = m.date + ' ' + (m.time || '00:00');
          if (matchDt > nowStr) return true;
        }
      }
      return false;
    },
    hasChampionPick() {
      return this.championPick && this.championPick.champion;
    },
    championPickFlagUrl() {
      const c = this.countries.find(x => x.name === this.championPick?.champion);
      return c ? flagUrl(c.flag) : '';
    },
    championPickLabel() {
      if (!this.hasChampionPick) return '';
      return this.championPick.champion;
    },
    todayStr() {
      return new Date().toISOString().split('T')[0];
    },
    tomorrowStr() {
      return new Date(new Date().getTime() + 86400000).toISOString().split('T')[0];
    },
    dayAfterTomorrowStr() {
      return new Date(new Date().getTime() + 172800000).toISOString().split('T')[0];
    },
    filteredGroups() {
      const today = this.todayStr;
      const tomorrow = this.tomorrowStr;
      const dayAfter = this.dayAfterTomorrowStr;

      if (this.activeTab === 'HOY') {
        return this.matchGroups.filter(g => g.date === today);
      } else if (this.activeTab === 'MAÑANA') {
        return this.matchGroups.filter(g => g.date === tomorrow);
      } else {
        return this.matchGroups.filter(g => g.date === dayAfter);
      }
    }
  },
  methods: {
    formatDate,
    roundLabel,
    compactDate(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      return parts[2] + '/' + parts[1];
    },
    isMatchPast(match) {
      if (!match.date || !match.time) return false;
      const now = new Date();
      const nowStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      return (match.date + ' ' + match.time) < nowStr;
    },
    matchState(match) {
      if (this.predictions[match.id]?.id) return 'submitted';
      if (match.status === 'finished') return 'finished';
      if (match.status === 'closed' || this.isMatchPast(match)) return 'closed';
      return 'open';
    },
    canPredict(match) {
      return this.matchState(match) === 'open';
    },
    hasUnsavedPredictions() {
      return this.filteredGroups.some(g =>
        g.matches.some(m => this.canPredict(m) && !this.predictions[m.id]?.id)
      );
    },
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
    },
    saveChampionPick() {
      if (!this.championSelected) return;
      if (!confirm(`¿Estás seguro de que "${this.championSelected}" será el campeón?\n\n⚠️ Solo podrás hacer esto UNA VEZ. No podrás cambiarlo después.`)) return;
      this.$emit('save-champion-pick', this.championSelected);
    },
  template: `
    <div class="view-container">
      <div class="section-banner">
        <span class="banner-icon">⚽</span>
        <div>
          <h2 class="banner-title">¡BIENVENIDO!</h2>
          <p class="banner-subtitle">Realiza tus pronósticos y suma puntos</p>
        </div>
      </div>

      <!-- Champion Pick -->
      <div class="card" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
        <span style="font-size: 2rem;">🏆</span>
        <div style="flex: 1;">
          <h3 class="form-label" style="font-size: 0.8rem; margin: 0;">PRONÓSTICO DEL CAMPEÓN</h3>
          <template v-if="hasChampionPick">
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-bottom: 0.5rem;">Tu pronóstico está registrado.</p>
            <div style="padding: 0.5rem; background: #f0fdf4; border-radius: 4px; text-align: center; font-weight: 600; display:flex;align-items:center;justify-content:center;gap:0.5rem;">
              <img v-if="championPickFlagUrl" :src="championPickFlagUrl" alt="" style="width:24px;height:18px;border-radius:2px;">
              <span>🏆</span>
              <span>{{ championPickLabel }}</span> ✅
            </div>
          </template>
          <template v-else-if="championPickOpen">
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-bottom: 0.5rem;">Selecciona tu campeón del mundial.</p>
            <div style="display: flex; gap: 0.5rem;">
              <select v-model="championSelected" style="flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: var(--font-main);">
                 <option value="">Seleccionar...</option>
                 <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <button class="btn btn-primary" @click="saveChampionPick" :disabled="!championSelected" style="padding: 0.5rem 1rem; font-size: 0.8rem;">GUARDAR</button>
            </div>
          </template>
          <template v-else>
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-bottom: 0.5rem;">La selección del campeón se habilitará próximamente.</p>
            <div style="padding: 0.5rem; background: #f5f5f5; border-radius: 4px; text-align: center; color: var(--color-gray); font-size: 0.85rem;">
              ⏳ No disponible
            </div>
          </template>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <button class="tab-btn" :class="{active: activeTab === 'HOY'}" @click="activeTab = 'HOY'">
          <div>HOY</div>
          <div style="font-size: 0.55rem; opacity: 0.7; margin-top: 2px;">{{ compactDate(todayStr) }}</div>
        </button>
        <button class="tab-btn" :class="{active: activeTab === 'MAÑANA'}" @click="activeTab = 'MAÑANA'">
          <div>MAÑANA</div>
          <div style="font-size: 0.55rem; opacity: 0.7; margin-top: 2px;">{{ compactDate(tomorrowStr) }}</div>
        </button>
        <button class="tab-btn" :class="{active: activeTab === 'PASADO'}" @click="activeTab = 'PASADO'">
          <div>PASADO MAÑANA</div>
          <div style="font-size: 0.55rem; opacity: 0.7; margin-top: 2px;">{{ compactDate(dayAfterTomorrowStr) }}</div>
        </button>
      </div>

      <div v-for="group in filteredGroups" :key="group.date" class="date-section">
        <div class="date-header">
          <span>{{ formatDate(group.date) }}</span>
          <span v-if="groupPoints(group) > 0" class="pts-total">{{ groupPoints(group) }} PTS</span>
        </div>
        
        <div v-for="match in group.matches" :key="match.id" class="card" :class="'card-' + matchState(match)" style="margin-bottom: 0.75rem; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.7rem; color: var(--color-gray);">{{ match.time }}</span>
            <span class="round-badge" :class="'round-' + (match.round || 'group')">{{ roundLabel(match.round) }}</span>
          </div>

          <div class="match-row" style="border: none;">
            <div class="team-info home">
              <span class="team-name">{{ match.home_team }}</span>
              <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="team-flag">
              <span v-else class="team-flag">{{ match.home_flag }}</span>
            </div>

            <div class="score-box">
              <input type="number" class="input-score"
                :value="predictions[match.id]?.home"
                @input="$emit('set-score', match.id, 'home', $event.target.value)"
                @focus="$event.target.select()"
                :disabled="!canPredict(match)"
                min="0" max="30">
              <span>-</span>
              <input type="number" class="input-score"
                :value="predictions[match.id]?.away"
                @input="$emit('set-score', match.id, 'away', $event.target.value)"
                @focus="$event.target.select()"
                :disabled="!canPredict(match)"
                min="0" max="30">
            </div>

            <div class="team-info away">
              <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="team-flag">
              <span v-else class="team-flag">{{ match.away_flag }}</span>
              <span class="team-name">{{ match.away_team }}</span>
            </div>
          </div>
            
          <div v-if="matchState(match) === 'open'" style="margin-top: 0.5rem; text-align: center;">
            <button class="comodin-btn" :class="{'comodin-active': predictions[match.id]?.comodin}" @click="$emit('toggle-comodin', match.id)" :disabled="!predictions[match.id]?.comodin && comodinUsado">
              🍀 {{ predictions[match.id]?.comodin ? 'Comodín Activo' : 'Usar Comodín' }}
            </button>
          </div>
          <div v-else-if="matchState(match) === 'submitted' && predictions[match.id]?.comodin" style="margin-top: 0.5rem; text-align: center;">
            <span class="comodin-btn comodin-active" style="cursor: default;">🍀 Comodín Activo</span>
          </div>

          <div v-if="match.status === 'finished'" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.06); font-size: 0.75rem;">
            <span style="color: var(--color-gray);">Resultado: {{ match.home_score }} - {{ match.away_score }}</span>
            <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
            <span v-else class="pts-badge wrong">0 PTS</span>
          </div>
        </div>
      </div>

      <button class="btn btn-primary w-full" @click="$emit('submit')" :disabled="saving || !hasUnsavedPredictions()">
         {{ saving ? 'GUARDANDO...' : 'ENVIAR PRONÓSTICOS' }}
      </button>
      <p style="font-size: 0.7rem; text-align: center; margin-top: 0.5rem; color: var(--color-gray);">
        <template v-if="!hasUnsavedPredictions() && !saving">Completá los marcadores para enviar.</template>
        <template v-else>Envía tus pronósticos antes de 1 minuto del inicio de cada partido.</template>
      </p>
    </div>
  `
};
