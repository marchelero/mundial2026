import { roundLabel, formatDate } from '../utils/helpers.js';

export default {
  props: ['matchGroups', 'predictions', 'user', 'saving', 'comodinUsado', 'comodinMatchName', 'countries', 'settings', 'championPick'],
  emits: ['set-score', 'toggle-comodin', 'submit', 'save-champion-pick'],
  data() {
    return {
      activeTab: 'HOY',
      championSelected: '',
    };
  },
  computed: {
    championPickOpen() {
      return this.settings?.champion_pick_open === 'true';
    },
    hasChampionPick() {
      return this.championPick && this.championPick.champion;
    },
    championPickLabel() {
      if (!this.hasChampionPick) return '';
      const c = this.countries.find(c => c.name === this.championPick.champion);
      return c ? `${c.flag} ${c.name}` : this.championPick.champion;
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
        return this.matchGroups.filter(g => g.date >= dayAfter);
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
    saveChampionPick() {
      if (!this.championSelected) return;
      this.$emit('save-champion-pick', this.championSelected);
    }
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
            <div style="padding: 0.5rem; background: #f0fdf4; border-radius: 4px; text-align: center; font-weight: 600;">
              {{ championPickLabel }} ✅
            </div>
          </template>
          <template v-else-if="championPickOpen">
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-bottom: 0.5rem;">Selecciona tu campeón del mundial.</p>
            <div style="display: flex; gap: 0.5rem;">
              <select v-model="championSelected" style="flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: var(--font-main);">
                 <option value="">Seleccionar...</option>
                 <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.flag }} {{ c.name }}</option>
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
        <h3 class="form-label" style="margin-bottom: 1rem; color: var(--color-gray);">{{ formatDate(group.date) }}</h3>
        
        <div v-for="match in group.matches" :key="match.id" class="card" style="margin-bottom: 1rem; position: relative;">
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--color-gray); margin-bottom: 0.5rem;">
            <span>{{ match.time }}</span>
            <span>{{ roundLabel(match.round) }}</span>
          </div>

          <div class="match-row" style="border: none;">
            <div class="team-info home">
              <span class="team-name">{{ match.home_team }}</span>
              <span class="team-flag">{{ match.home_flag }}</span>
            </div>

            <div class="score-box">
              <input type="number" class="input-score" 
                :value="predictions[match.id]?.home" 
                @input="$emit('set-score', match.id, 'home', $event.target.value)"
                :disabled="predictions[match.id]?.id">
              <span>-</span>
              <input type="number" class="input-score" 
                :value="predictions[match.id]?.away" 
                @input="$emit('set-score', match.id, 'away', $event.target.value)"
                :disabled="predictions[match.id]?.id">
            </div>

            <div class="team-info away">
              <span class="team-flag">{{ match.away_flag }}</span>
              <span class="team-name">{{ match.away_team }}</span>
            </div>
            
            <div v-if="!predictions[match.id]?.id" style="position: absolute; right: 10px; top: 10px;">
              <span v-if="predictions[match.id]?.comodin" @click="$emit('toggle-comodin', match.id)">🍀</span>
              <span v-else-if="!comodinUsado" @click="$emit('toggle-comodin', match.id)" style="opacity: 0.3;">🍀</span>
            </div>
            <div v-else style="position: absolute; right: 10px; top: 10px;">
               <span v-if="predictions[match.id]?.comodin">🍀</span>
               <span>✅</span>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary w-full" @click="$emit('submit')" :disabled="saving">
         {{ saving ? 'GUARDANDO...' : 'ENVIAR PRONÓSTICOS' }}
      </button>
      <p style="font-size: 0.7rem; text-align: center; margin-top: 0.5rem; color: var(--color-gray);">
        Envía tus pronósticos antes de 1 minuto del inicio de cada partido.
      </p>
    </div>
  `
};
