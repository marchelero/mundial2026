import { flagUrl } from '../utils/helpers.js';

export default {
  props: ['matches', 'settings', 'isAdmin', 'countries'],
  emits: ['save-score', 'delete-match', 'add-match', 'export-csv', 'export-match', 'save-setting'],
  data() {
    return {
      newMatch: {
        home_team: '',
        away_team: '',
        date: '',
        time: '',
        timeHour: '',
        timeMinute: '',
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
    flagMap() {
      const m = {};
      this.countries.forEach(c => { m[c.name] = flagUrl(c.flag); });
      return m;
    },
    isFormValid() {
      return this.newMatch.home_team &&
        this.newMatch.away_team &&
        this.countries.some(c => c.name === this.newMatch.home_team) &&
        this.countries.some(c => c.name === this.newMatch.away_team) &&
        this.newMatch.home_team !== this.newMatch.away_team &&
        this.newMatch.date &&
        this.newMatch.timeHour !== '' &&
        this.newMatch.timeMinute !== '';
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
      const validHome = this.countries.some(c => c.name === this.newMatch.home_team);
      const validAway = this.countries.some(c => c.name === this.newMatch.away_team);
      if (!this.newMatch.home_team || !validHome) this.errors.home_team = 'Seleccioná un país válido de la lista';
      if (!this.newMatch.away_team || !validAway) this.errors.away_team = 'Seleccioná un país válido de la lista';
      if (validHome && validAway && this.newMatch.home_team === this.newMatch.away_team) {
        this.errors.away_team = 'Los equipos deben ser distintos';
      }
      if (!this.newMatch.date) this.errors.date = 'Selecciona la fecha';
      if (this.newMatch.timeHour === '' || this.newMatch.timeMinute === '') {
        this.errors.time = 'Ingresa la hora';
      }
      if (Object.keys(this.errors).length > 0) return;
      const h = String(this.newMatch.timeHour || 0).padStart(2, '0');
      const m = String(this.newMatch.timeMinute || 0).padStart(2, '0');
      this.newMatch.time = h + ':' + m;
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
                 <div style="display:flex;align-items:center;gap:0.5rem;">
                   <img v-if="flagMap[newMatch.home_team]" :src="flagMap[newMatch.home_team]" alt="" style="width:24px;height:18px;border-radius:2px;">
                   <span v-else style="width:24px;"></span>
                   <input type="text" v-model="newMatch.home_team" list="homeTeams" class="form-input" :class="{'input-error': errors.home_team}" placeholder="Escribí o seleccioná..." style="flex:1;padding-left:0.5rem;">
                   <datalist id="homeTeams">
                     <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
                   </datalist>
                 </div>
                 <span v-if="errors.home_team" class="field-error">{{ errors.home_team }}</span>
              </div>
              <div class="form-group">
                 <label class="form-label">Visitante</label>
                 <div style="display:flex;align-items:center;gap:0.5rem;">
                   <img v-if="flagMap[newMatch.away_team]" :src="flagMap[newMatch.away_team]" alt="" style="width:24px;height:18px;border-radius:2px;">
                   <span v-else style="width:24px;"></span>
                   <input type="text" v-model="newMatch.away_team" list="awayTeams" class="form-input" :class="{'input-error': errors.away_team}" placeholder="Escribí o seleccioná..." style="flex:1;padding-left:0.5rem;">
                   <datalist id="awayTeams">
                     <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
                   </datalist>
                 </div>
                 <span v-if="errors.away_team" class="field-error">{{ errors.away_team }}</span>
              </div>
             <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" v-model="newMatch.date" class="form-input" :class="{'input-error': errors.date}" style="padding-left: 0.5rem;">
                <span v-if="errors.date" class="field-error">{{ errors.date }}</span>
             </div>
              <div class="form-group">
                 <label class="form-label">Hora (24h)</label>
                 <div style="display:flex;gap:0.25rem;align-items:center;">
                   <input type="number" v-model="newMatch.timeHour" min="0" max="23" placeholder="HH" class="form-input" :class="{'input-error': errors.time}" style="width:55px;text-align:center;padding:0.4rem;">
                   <span style="font-weight:700;">:</span>
                   <input type="number" v-model="newMatch.timeMinute" min="0" max="59" step="5" placeholder="MM" class="form-input" :class="{'input-error': errors.time}" style="width:55px;text-align:center;padding:0.4rem;">
                 </div>
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
        
        <div v-for="match in filteredMatches" :key="match.id" class="admin-match-row" :class="{'admin-match-finished': match.status === 'finished'}" style="flex-direction: column; align-items: stretch;">
           <div style="display: flex; align-items: center; width: 100%;">
             <div class="admin-col-time">
               <div style="font-size: 0.6rem; opacity: 0.6;">{{ compactDate(match.date) }}</div>
               <div style="font-size: 0.75rem;">{{ match.time }}</div>
             </div>
              <div class="admin-col-team home">
                 <span class="admin-team-name">{{ match.home_team }}</span>
                 <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="admin-team-flag">
                 <span v-else class="admin-team-flag">{{ match.home_flag }}</span>
              </div>
              
               <div class="admin-col-score">
                  <input type="number" class="input-score" v-model="match.home_score" @focus="$event.target.select()" min="0" max="30" style="width: 30px; height: 30px; font-size: 0.85rem;">
                  <span style="font-size: 0.85rem;">-</span>
                  <input type="number" class="input-score" v-model="match.away_score" @focus="$event.target.select()" min="0" max="30" style="width: 30px; height: 30px; font-size: 0.85rem;">
               </div>
   
              <div class="admin-col-team away">
                 <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="admin-team-flag">
                 <span v-else class="admin-team-flag">{{ match.away_flag }}</span>
                 <span class="admin-team-name">{{ match.away_team }}</span>
              </div>
  
             <div class="admin-col-actions">
                <button class="btn btn-primary" @click="$emit('save-score', match)" style="padding: 0.3rem 0.4rem; font-size: 0.65rem;">💾</button>
                <button class="btn" @click="$emit('delete-match', match.id)" style="padding: 0.3rem 0.4rem; font-size: 0.65rem; background: var(--color-red); color: white;">🗑️</button>
             </div>
           </div>
           <div v-if="match.status === 'finished'" style="width: 100%; text-align: center; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed rgba(0,0,0,0.1);">
             <span style="font-size: 0.6rem; color: var(--color-green); cursor: pointer; font-weight: 600;" @click="$emit('export-match', match)">📥 Exportar predicciones</span>
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
