import { roundLabel, formatDate, calcPoints, flagUrl, todayStr as todayStrLocal, addDaysStr as addDaysStrLocal, nowStr } from '../utils/helpers.js';
import { api } from '../services/api.js';

export default {
  props: ['matchGroups', 'predictions', 'user', 'saving', 'comodinUsado', 'countries', 'settings', 'championPick'],
  emits: ['set-score', 'toggle-comodin', 'submit', 'save-champion-pick', 'saved', 'save-error'],
  data() {
    return {
      activeTab: 'HOY',
      championSelected: '',
      showConfirmModal: false,
      pendingMatches: [],
    };
  },
  computed: {
    championDeadlinePassed() {
      const now = new Date();
      // Domingo 28 de junio de 2026 15:00 hora Bolivia (America/La_Paz)
      const deadline = new Date('2026-06-28T15:00:00-04:00');
      return now >= deadline;
    },
    championPickOpen() {
      if (this.championDeadlinePassed) return false;
      if (this.settings && this.settings.champion_pick_open !== undefined) {
        return String(this.settings.champion_pick_open) === 'true';
      }
      return false;
    },
    hasChampionPick() {
      return this.championPick && this.championPick.champion && this.championPick.champion !== '';
    },
    championPickLabel() {
      return this.championPick?.champion || '';
    },
    championPickFlagUrl() {
      if (!this.championPickLabel) return '';
      const c = this.countries.find(x => x.name === this.championPickLabel);
      return c ? flagUrl(c.flag) : '';
    },
    todayStr() {
      return todayStrLocal();
    },
    tomorrowStr() {
      return addDaysStrLocal(1);
    },
    dayAfterTomorrowStr() {
      return addDaysStrLocal(2);
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
      return (match.date + ' ' + match.time) < nowStr();
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
    async saveChampionPick() {
      if (!this.championSelected) return;
      if (!confirm(`¿Estás seguro de que "${this.championSelected}" será el campeón?\n\n⚠️ Solo podrás hacer esto UNA VEZ. No podrás cambiarlo después.`)) return;
      try {
        await api.post('/champion-picks', { champion: this.championSelected });
        this.$emit('saved');
      } catch (e) {
        this.$emit('save-error', e.message || 'Error al guardar');
      }
    },
    openSubmitModal() {
      const pending = [];
      this.matchGroups.forEach(g => {
        g.matches.forEach(m => {
          if (this.canPredict(m) && !this.predictions[m.id]?.id && this.predictions[m.id]?.home != null && this.predictions[m.id]?.away != null) {
            pending.push(m);
          }
        });
      });
      if (pending.length === 0) return;
      this.pendingMatches = pending;
      this.showConfirmModal = true;
    },
    closeModal() {
      this.showConfirmModal = false;
      this.pendingMatches = [];
    },
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
      <div class="card" style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; padding: 1.25rem;">
        <div class="stat-icon" style="width: 48px; height: 48px; background: #fffcf0; border: 1px solid #fee2e2; border-radius: 12px; font-size: 2rem;">🏆</div>
        <div style="flex: 1;">
          <h3 class="stat-label" style="margin-bottom: 0.25rem; color: var(--color-dark);">PRONÓSTICO DEL CAMPEÓN</h3>
          
          <!-- STATE 1: ALREADY PICKED -->
          <template v-if="hasChampionPick">
            <p style="font-size: 0.65rem; color: var(--color-gray); margin-bottom: 0.75rem; font-family: var(--font-main);">Tu pronóstico está registrado y asegurado.</p>
            <div style="padding: 0.75rem; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; display:flex; align-items:center; gap:0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
              <img v-if="championPickFlagUrl" :src="championPickFlagUrl" alt="" style="width:28px; height:20px; border-radius:3px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="flex: 1;">
                <div style="font-size: 0.55rem; color: #15803d; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">MI CAMPEÓN</div>
                <div style="font-family: var(--font-header); font-size: 1.25rem; color: #166534; line-height: 1;">{{ championPickLabel }}</div>
              </div>
              <span style="color: #22c55e; font-size: 1.2rem;">✓</span>
            </div>
          </template>

          <!-- STATE 2: OPEN FOR PICKING -->
          <template v-else-if="championPickOpen">
            <p style="font-size: 0.65rem; color: var(--color-gray); margin-bottom: 0.75rem; font-family: var(--font-main);">Selecciona el equipo que crees que ganará la copa.</p>
            <div style="display: flex; gap: 0.5rem; align-items: stretch;">
              <select v-model="championSelected" style="flex: 1; padding: 0.65rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: var(--font-main); font-size: 0.9rem; background: #f8fafc; color: var(--color-dark); cursor: pointer;">
                 <option value="">Seleccionar...</option>
                 <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <button class="btn btn-primary" @click="saveChampionPick" :disabled="!championSelected" style="padding: 0 1.25rem; font-family: var(--font-header); font-size: 1rem; border-radius: 8px; letter-spacing: 0.05em;">GUARDAR</button>
            </div>
          </template>

          <!-- STATE 3: COMING SOON -->
          <template v-else-if="!championDeadlinePassed">
            <p style="font-size: 0.65rem; color: var(--color-gray); margin-bottom: 0.75rem; font-family: var(--font-main);">La selección del campeón se habilitará pronto según las reglas del admin.</p>
            <div style="padding: 0.75rem; background: #f1f5f9; border-radius: 8px; text-align: center; color: #64748b; font-size: 0.85rem; font-family: var(--font-header); letter-spacing: 0.05em; opacity: 0.7;">
              ⏳ PRÓXIMAMENTE
            </div>
          </template>

          <!-- STATE 4: CLOSED BY RULES (PAST DEADLINE &amp; NO PICK) -->
          <template v-else>
            <p style="font-size: 0.65rem; color: #ef4444; margin-bottom: 0.75rem; font-family: var(--font-main); font-weight: 500;">La fecha límite para el pronóstico del campeón ya pasó.</p>
            <div style="padding: 0.75rem; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; text-align: center; color: #991b1b; font-size: 0.85rem; font-family: var(--font-header); letter-spacing: 0.05em;">
              🚫 TE PERDISTE EL PRONÓSTICO DEL CAMPEÓN
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
            <div style="display:flex;align-items:center;gap:0.35rem;">
              <span class="match-time-badge">🕒 {{ match.time }}</span>
              <span v-if="match.status === 'finished'" style="font-size:0.55rem;font-weight:700;color:var(--color-dark);background:#e2e8f0;padding:0.1rem 0.3rem;border-radius:4px;">FINALIZADO</span>
              <span v-else-if="isMatchPast(match)" style="font-size:0.55rem;font-weight:700;color:#dc2626;background:#fef2f2;padding:0.1rem 0.3rem;border-radius:4px;animation:pulse 1.5s infinite;">🔴 JUGANDO</span>
            </div>
            <span v-if="predictions[match.id]?.comodin && !predictions[match.id]?.id" style="display:flex;align-items:center;gap:0.25rem;font-size:0.7rem;font-weight:700;color:#d97706;background:#fef3c7;padding:0.1rem 0.4rem;border-radius:4px;">
              ⭐ COMODÍN
              <span @click="$emit('toggle-comodin', match.id)" style="cursor:pointer;font-size:0.8rem;color:#92400e;margin-left:2px;" title="Quitar comodín">✕</span>
            </span>
            <span v-else-if="predictions[match.id]?.comodin" style="font-size:0.7rem;font-weight:700;color:#166534;background:#dcfce7;padding:0.1rem 0.4rem;border-radius:4px;">⭐ COMODÍN</span>
            <span class="round-badge" :class="'round-' + (match.round || 'group')">{{ roundLabel(match.round) }}</span>
          </div>

          <div class="match-row" style="border: none;">
            <div class="team-info home">
              <span class="team-name">{{ match.home_team }}</span>
              <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="team-flag">
              <span v-else class="team-flag">{{ match.home_flag }}</span>
            </div>

            <div class="score-box">
              <template v-if="predictions[match.id]?.id || !canPredict(match)">
                <span class="input-score" style="line-height: 35px; background: #f1f5f9; cursor: default;">{{ predictions[match.id]?.home ?? '-' }}</span>
                <span>-</span>
                <span class="input-score" style="line-height: 35px; background: #f1f5f9; cursor: default;">{{ predictions[match.id]?.away ?? '-' }}</span>
              </template>
              <template v-else>
                <input type="text" class="input-score"
                  :value="predictions[match.id]?.home"
                  @input="$emit('set-score', match.id, 'home', $event.target.value)"
                  @focus="$event.target.select()"
                  :disabled="!canPredict(match)"
                  inputmode="numeric">
                <span>-</span>
                <input type="text" class="input-score"
                  :value="predictions[match.id]?.away"
                  @input="$emit('set-score', match.id, 'away', $event.target.value)"
                  @focus="$event.target.select()"
                  :disabled="!canPredict(match)"
                  inputmode="numeric">
              </template>
            </div>

            <div class="team-info away">
              <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="team-flag">
              <span v-else class="team-flag">{{ match.away_flag }}</span>
              <span class="team-name">{{ match.away_team }}</span>
            </div>
          </div>
            
          <div v-if="matchState(match) === 'open' && !predictions[match.id]?.comodin && !comodinUsado" style="margin-top: 0.5rem; text-align: center;">
            <button class="comodin-btn" @click="$emit('toggle-comodin', match.id)">
              🍀 Usar Comodín
            </button>
          </div>

          <div v-if="match.status === 'finished'" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.06); font-size: 0.75rem;">
            <span style="color: var(--color-gray);">Resultado: {{ match.home_score }} - {{ match.away_score }}</span>
            <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
            <span v-else class="pts-badge wrong">0 PTS</span>
          </div>
        </div>
      </div>

      <button class="btn btn-primary w-full" @click="openSubmitModal" :disabled="saving || !hasUnsavedPredictions()">
         {{ saving ? 'GUARDANDO...' : 'ENVIAR PRONÓSTICOS' }}
      </button>
      <p style="font-size: 0.7rem; text-align: center; margin-top: 0.5rem; color: var(--color-gray);">
        <template v-if="!hasUnsavedPredictions() && !saving">Completá los marcadores para enviar.</template>
        <template v-else>Envía tus pronósticos antes de 1 minuto del inicio de cada partido.</template>
      </p>

      <!-- Confirm Modal -->
      <div v-if="showConfirmModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;" @click.self="closeModal">
        <div style="background:white;border-radius:12px;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="text-align:center;margin-bottom:1rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📋</div>
            <h3 style="font-family:var(--font-header);font-size:1.2rem;margin:0 0 0.25rem;">CONFIRMAR ENVÍO</h3>
            <p style="font-size:0.75rem;color:var(--color-gray);margin:0;">Una vez enviados no podrás modificarlos.</p>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:0.75rem;margin-bottom:1rem;max-height:200px;overflow-y:auto;">
            <div v-for="m in pendingMatches" :key="m.id" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;font-size:0.8rem;border-bottom:1px solid rgba(0,0,0,0.05);">
              <span style="font-weight:600;flex:1;">{{ m.home_team }} vs {{ m.away_team }}</span>
              <span style="font-weight:700;background:var(--color-dark);color:white;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.75rem;">{{ predictions[m.id]?.home }} - {{ predictions[m.id]?.away }}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button @click="closeModal" style="flex:1;padding:0.65rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;">CANCELAR</button>
            <button @click="$emit('submit'); closeModal()" style="flex:1;padding:0.65rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;">ACEPTAR</button>
          </div>
        </div>
      </div>
    </div>
  `
};
