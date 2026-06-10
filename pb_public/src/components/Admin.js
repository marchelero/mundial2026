export default {
  props: ['matches', 'settings', 'isAdmin', 'countries'],
  emits: ['save-score', 'delete-match', 'add-match', 'export-csv', 'save-setting'],
  data() {
    return {
      newMatch: {
        home_team: '',
        away_team: '',
        date: '',
        time: '',
        round: 'group',
        home_score: null,
        away_score: null,
        status: 'open'
      },
      showAddForm: false,
      errors: {},
      adminTab: 'nuevos'
    };
  },
  computed: {
    isFormValid() {
      return this.newMatch.home_team &&
        this.newMatch.away_team &&
        this.newMatch.home_team !== this.newMatch.away_team &&
        this.newMatch.date &&
        this.newMatch.time;
    },
    filteredMatches() {
      const today = new Date().toISOString().split('T')[0];
      return this.matches.filter(m => {
        if (this.adminTab === 'nuevos') return m.date >= today;
        return m.date < today;
      });
    }
  },
  methods: {
    compactDate(dateStr) {
      const parts = dateStr.split('-');
      return parts[2] + '/' + parts[1];
    },
    submitMatch() {
      this.errors = {};
      if (!this.newMatch.home_team) this.errors.home_team = 'Selecciona equipo local';
      if (!this.newMatch.away_team) this.errors.away_team = 'Selecciona equipo visitante';
      if (this.newMatch.home_team && this.newMatch.away_team && this.newMatch.home_team === this.newMatch.away_team) {
        this.errors.away_team = 'Los equipos deben ser distintos';
      }
      if (!this.newMatch.date) this.errors.date = 'Selecciona la fecha';
      if (!this.newMatch.time) this.errors.time = 'Selecciona la hora';
      if (Object.keys(this.errors).length > 0) return;
      this.$emit('add-match', { ...this.newMatch });
      this.showAddForm = false;
    }
  },
  template: `
    <div class="view-container">
      <div class="section-banner">
        <span class="banner-icon">⚙️</span>
        <div>
          <h2 class="banner-title">MODO ADMINISTRADOR</h2>
          <p class="banner-subtitle">Gestión de partidos y exportación de datos.</p>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-box" @click="showAddForm = !showAddForm" style="cursor: pointer; background: var(--color-dark); color: white;">
          <span class="stat-label" style="color: white;">Nuevo Partido</span>
          <span class="stat-value">➕</span>
        </div>
        <div class="stat-box" @click="$emit('export-csv')" style="cursor: pointer; background: var(--color-green); color: white;">
          <span class="stat-label" style="color: white;">Exportar Excel</span>
          <span class="stat-value">📊</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Total Partidos</span>
          <span class="stat-value">{{ matches.length }}</span>
        </div>
      </div>

      <!-- Add Match Form -->
      <transition name="fade">
        <div v-if="showAddForm" class="card" style="border: 2px solid var(--color-dark);">
          <h3 class="form-label" style="margin-bottom: 1rem;">Registrar Nuevo Partido</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
             <div class="form-group">
                <label class="form-label">Local</label>
                <select v-model="newMatch.home_team" class="form-input" :class="{'input-error': errors.home_team}" style="padding-left: 0.5rem;">
                   <option value="">Seleccionar...</option>
                   <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.flag }} {{ c.name }}</option>
                </select>
                <span v-if="errors.home_team" class="field-error">{{ errors.home_team }}</span>
             </div>
             <div class="form-group">
                <label class="form-label">Visitante</label>
                <select v-model="newMatch.away_team" class="form-input" :class="{'input-error': errors.away_team}" style="padding-left: 0.5rem;">
                   <option value="">Seleccionar...</option>
                   <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.flag }} {{ c.name }}</option>
                </select>
                <span v-if="errors.away_team" class="field-error">{{ errors.away_team }}</span>
             </div>
             <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" v-model="newMatch.date" class="form-input" :class="{'input-error': errors.date}" style="padding-left: 0.5rem;">
                <span v-if="errors.date" class="field-error">{{ errors.date }}</span>
             </div>
             <div class="form-group">
                <label class="form-label">Hora</label>
                <input type="time" v-model="newMatch.time" class="form-input" :class="{'input-error': errors.time}" style="padding-left: 0.5rem;">
                <span v-if="errors.time" class="field-error">{{ errors.time }}</span>
             </div>
          </div>
          <button class="btn btn-primary w-full" :disabled="!isFormValid" @click="submitMatch" style="margin-top: 1rem;">
            GUARDAR PARTIDO
          </button>
        </div>
      </transition>

      <div class="card">
        <div class="tabs-container" style="background: none; border-bottom: 1px solid rgba(0,0,0,0.1); border-radius: 0; margin-bottom: 0.75rem;">
          <button class="tab-btn" :class="{active: adminTab === 'nuevos'}" @click="adminTab = 'nuevos'">PRÓXIMOS</button>
          <button class="tab-btn" :class="{active: adminTab === 'antiguos'}" @click="adminTab = 'antiguos'">FINALIZADOS</button>
        </div>
        
        <div v-for="match in filteredMatches" :key="match.id" class="admin-match-row">
           <div class="admin-col-time">
             <div style="font-size: 0.6rem; opacity: 0.6;">{{ compactDate(match.date) }}</div>
             <div style="font-size: 0.75rem;">{{ match.time }}</div>
           </div>
           <div class="admin-col-team home">
              <span class="admin-team-name">{{ match.home_team }}</span>
              <span class="admin-team-flag">{{ match.home_flag }}</span>
           </div>
           
           <div class="admin-col-score">
              <input type="number" class="input-score" v-model="match.home_score" style="width: 30px; height: 30px; font-size: 0.85rem;">
              <span style="font-size: 0.85rem;">-</span>
              <input type="number" class="input-score" v-model="match.away_score" style="width: 30px; height: 30px; font-size: 0.85rem;">
           </div>

           <div class="admin-col-team away">
              <span class="admin-team-flag">{{ match.away_flag }}</span>
              <span class="admin-team-name">{{ match.away_team }}</span>
           </div>

           <div class="admin-col-actions">
              <button class="btn btn-primary" @click="$emit('save-score', match)" style="padding: 0.3rem 0.4rem; font-size: 0.65rem;">💾</button>
              <button class="btn" @click="$emit('delete-match', match.id)" style="padding: 0.3rem 0.4rem; font-size: 0.65rem; background: var(--color-red); color: white;">🗑️</button>
           </div>
        </div>
      </div>
<!--  SECCION OCULTA DEUDA TECNICA PARA MEJORAR A FUTURO NO BORRAR:..
      <div class="card">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="font-size: 1.5rem;">🏆</span>
          <div style="flex: 1;">
            <h3 class="form-label" style="font-size: 0.8rem; margin: 0;">PRONÓSTICO DEL CAMPEÓN</h3>
            <p style="font-size: 0.6rem; color: var(--color-gray);">Permitir a los usuarios seleccionar su campeón.</p>
          </div>
          <button class="btn" :style="settings.champion_pick_open === 'true' ? 'background: var(--color-green); color: white;' : 'background: var(--color-gray); color: white;'" @click="$emit('save-setting', { key: 'champion_pick_open', value: settings.champion_pick_open === 'true' ? 'false' : 'true' })" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; min-width: 70px;">
            {{ settings.champion_pick_open === 'true' ? 'ACTIVO' : 'INACTIVO' }}
          </button>
        </div>
      </div>
-->
      <div class="card" style="background: #fffbeb; border: 1px solid #fcd34d;">
        <p style="font-size: 0.75rem; color: #92400e;">
          ⚠️ <strong>ADMIN:</strong> Al guardar un resultado, el partido se marca como "finalizado" y se activará el cálculo de puntos para los usuarios.
        </p>
      </div>
    </div>
  `
};
