import { flagUrl, roundLabel } from '../utils/helpers.js';
import { api } from '../services/api.js';

export default {
  props: ['matches', 'settings', 'isAdmin', 'countries'],
  emits: ['save-score', 'finish-match', 'add-match', 'export-csv', 'export-match', 'save-setting', 'award-champion'],
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
      adminTab: 'nuevos',
      whitelist: [],
      whitelistInput: '',
      whitelistSaved: false,
      whitelistLoaded: false,
      totalUsers: 0,
      showFinishModal: false,
      finishMatchData: null,
      showAwardModal: false,
      awardConfirmWinner: '',
      championWinner: '',
      championAwardSelected: '',
      awardLoading: false,
      awardDone: false,
      awardCount: 0
    };
  },
  async created() {
    try {
      const records = await api.get('/predictions/rankings');
      const users = new Set(records.map(r => r.user));
      this.totalUsers = users.size;
    } catch (_) { this.totalUsers = 0; }

    // Always load settings fresh to get champion_winner
    try {
      const r = await api.get('/settings');
      const s = {};
      for (const item of r) s[item.key] = item.value;
      this.championWinner = s.champion_winner || '';
      this._loadWhitelist(s.allowed_emails);
    } catch (_) { }
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
      return this.matches.filter(m => {
        if (this.adminTab === 'nuevos') return m.status !== 'finished';
        return m.status === 'finished';
      }).sort((a, b) => (a.date + ' ' + (a.time || '00:00')).localeCompare(b.date + ' ' + (b.time || '00:00')));
    }
  },
  methods: {
    roundLabel,
    _loadWhitelist(raw) {
      if (!raw || raw === '[]') { this.whitelist = []; this.whitelistLoaded = true; return; }
      try {
        const parsed = JSON.parse(raw);
        this.whitelist = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.whitelist = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
      this.whitelistLoaded = true;
    },
    addToWhitelist() {
      const email = this.whitelistInput.trim().toLowerCase();
      if (!email || !email.includes('@')) return;
      if (this.whitelist.includes(email)) { this.whitelistInput = ''; return; }
      this.whitelist.push(email);
      this.whitelistInput = '';
      this._saveWhitelist();
    },
    removeFromWhitelist(email) {
      this.whitelist = this.whitelist.filter(e => e !== email);
      this._saveWhitelist();
    },
    _saveWhitelist() {
      this.whitelistSaved = false;
      this.$emit('save-setting', { key: 'allowed_emails', value: JSON.stringify(this.whitelist) });
      this.whitelistSaved = true;
      setTimeout(() => this.whitelistSaved = false, 3000);
    },
    openFinishModal(match) {
      this.finishMatchData = match;
      this.showFinishModal = true;
    },
    confirmFinish() {
      if (this.finishMatchData) {
        this.$emit('finish-match', this.finishMatchData);
      }
      this.showFinishModal = false;
      this.finishMatchData = null;
    },
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
    },
    async awardChampion() {
      if (!this.championAwardSelected || this.awardLoading) return;
      this.awardConfirmWinner = this.championAwardSelected;
      this.showAwardModal = true;
    },
    confirmAward() {
      if (!this.awardConfirmWinner || this.awardLoading) return;
      this.showAwardModal = false;
      this.awardLoading = true;
      this.awardDone = false;
      api.post('/champion-picks/award', { winner: this.awardConfirmWinner })
        .then(result => {
          this.championWinner = result.winner;
          this.awardCount = result.awarded;
          this.awardDone = true;
          this.awardLoading = false;
        })
        .catch(e => {
          alert(e.message || 'Error al otorgar puntos');
          this.awardLoading = false;
        });
    },
    cancelAward() {
      this.showAwardModal = false;
      this.awardConfirmWinner = '';
    },
    onlyDigits(e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key;
      if (key === 'Backspace' || key === 'Delete' || key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End') return;
      if (!/^\d$/.test(key)) e.preventDefault();
    },
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
        <div class="stat-box" style="background: var(--color-dark); color: white; border: none;">
          <div class="stat-icon" style="color: white;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:24px;height:24px;">
              <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
            </svg>
          </div>
          <span class="stat-label" style="color: rgba(255,255,255,0.7);">Participantes</span>
          <span class="stat-value" style="color: white; font-size: 1rem; margin-top: 0.15rem;">{{ totalUsers }}</span>
        </div>
        <div class="stat-box" @click="$emit('export-csv')" style="cursor: pointer; background: var(--color-green); color: white; border: none;">
          <div class="stat-icon" style="color: white;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <span class="stat-label" style="color: rgba(255,255,255,0.85);">Exportar Excel</span>
        </div>
        <div class="stat-box">
          <span class="stat-value" style="line-height:1; margin-bottom: 0.2rem;">{{ matches.length }}</span>
          <span class="stat-label">PARTIDOS</span>
        </div>
      </div>

      <!-- Add Match Form -->
      <transition name="fade">
        <div v-if="showAddForm" class="card" style="border: 2px solid var(--color-dark);">
          <h3 class="form-label" style="margin-bottom: 1rem;">Registrar Nuevo Partido</h3>
          <div class="admin-add-grid">
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
              <div class="form-group full-row">
                 <label class="form-label">Tipo de partido</label>
                 <select v-model="newMatch.round" class="form-input" style="padding-left:0.5rem;">
                   <option value="group">Fase de Grupos</option>
                   <option value="round_32">32vos de Final</option>
                   <option value="round_16">16vos de Final</option>
                   <option value="quarter">Cuartos de Final</option>
                   <option value="semi">Semifinal</option>
                   <option value="final">Final</option>
                 </select>
              </div>
           </div>
           <button class="btn btn-primary w-full full-row" :disabled="!isFormValid" @click="submitMatch" style="margin-top: 1rem;">
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
                <div class="match-time-badge">{{ match.time }}</div>
                <span v-if="match.status === 'finished'" style="font-size:0.55rem;font-weight:700;color:var(--color-dark);background:#e2e8f0;padding:0.1rem 0.3rem;border-radius:4px;margin-top:2px;display:inline-block;">FINALIZADO</span>
                <div style="font-size:0.55rem;opacity:0.5;margin-top:2px;">{{ roundLabel(match.round) }}</div>
              </div>
              <div class="admin-col-team home">
                 <span class="admin-team-name">{{ match.home_team }}</span>
                 <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" class="admin-team-flag">
                 <span v-else class="admin-team-flag">{{ match.home_flag }}</span>
              </div>
              
                <div class="admin-col-score">
                   <input type="text" class="input-score" v-model="match.home_score" @focus="$event.target.select()" @keypress="onlyDigits" @paste.prevent inputmode="numeric">
                   <span style="font-size: 0.85rem;">-</span>
                   <input type="text" class="input-score" v-model="match.away_score" @focus="$event.target.select()" @keypress="onlyDigits" @paste.prevent inputmode="numeric">
                </div>
   
              <div class="admin-col-team away">
                 <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" class="admin-team-flag">
                 <span v-else class="admin-team-flag">{{ match.away_flag }}</span>
                 <span class="admin-team-name">{{ match.away_team }}</span>
              </div>
  
               <div v-if="match.status !== 'finished'" class="admin-col-actions">
                  <button class="btn btn-primary" @click="$emit('save-score', match)" :disabled="match.home_score == null || match.away_score == null" style="padding: 0.3rem 0.4rem; font-size: 0.65rem;" title="Guardar score">💾</button>
                  <button class="btn" @click="openFinishModal(match)" :disabled="match.home_score == null || match.away_score == null" style="padding: 0.3rem 0.4rem; font-size: 0.65rem; background: var(--color-accent); color: white;" title="Finalizar partido">🏁</button>
                </div>
            </div>
            <div v-if="match.status === 'finished'" style="width: 100%; text-align: center; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed rgba(0,0,0,0.1);">
              <span style="font-size: 0.6rem; color: var(--color-green); cursor: pointer; font-weight: 600;" @click="$emit('export-match', match)">📥 Exportar predicciones</span>
            </div>
            <div v-else style="width: 100%; text-align: center; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed rgba(0,0,0,0.05); font-size: 0.55rem; color: var(--color-gray);">
              {{ match.date }} — {{ match.time }}
        </div>
      </div>
      <div class="card">
        <div style="display: flex; align-items: flex-start; gap: 1rem;">
          <span style="font-size: 1.5rem;">👑</span>
          <div style="flex: 1;">
            <h3 class="form-label" style="font-size: 0.8rem; margin: 0;">OTORGAR PUNTOS DE CAMPEÓN</h3>
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-top: 0.2rem;">
              Una vez finalizado el mundial, seleccioná al campeón y otorgá +5 pts a quienes acertaron.
            </p>
            <div v-if="championWinner" style="margin-top: 0.75rem; padding: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #166534;">✅ CAMPEÓN REGISTRADO</div>
              <div style="font-size: 1rem; font-weight: 800; color: var(--color-dark); margin-top: 0.25rem;">{{ championWinner }}</div>
              <div v-if="awardDone" style="font-size: 0.7rem; color: #15803d; margin-top: 0.25rem;">{{ awardCount }} usuario(s) recibieron +5 pts</div>
            </div>
            <div v-else style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: stretch;">
              <select v-model="championAwardSelected" style="flex: 1; padding: 0.5rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: var(--font-main); font-size: 0.85rem; background: #f8fafc; cursor: pointer;">
                <option value="">Seleccionar campeón...</option>
                <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <button class="btn btn-primary" :disabled="!championAwardSelected || awardLoading" @click="awardChampion" style="padding: 0.5rem 1rem; font-size: 0.75rem; white-space: nowrap;">
                {{ awardLoading ? 'OTORGANDO...' : 'OTORGAR +5 PTS' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="font-size: 1.5rem;">🏆</span>
          <div style="flex: 1;">
            <h3 class="form-label" style="font-size: 0.8rem; margin: 0;">PRONÓSTICO DEL CAMPEÓN</h3>
            <p style="font-size: 0.6rem; color: var(--color-gray);">Cierre: Dom 28 jun 2026, 15:00.</p>
          </div>
          <div style="text-align: right;">
            <div :style="{fontSize:'0.55rem', fontWeight:700, textTransform:'uppercase', marginBottom:'0.15rem', color: settings.champion_pick_open === 'true' ? '#16a34a' : '#ef4444'}">{{ settings.champion_pick_open === 'true' ? 'HABILITADO' : 'DESHABILITADO' }}</div>
            <button @click="$emit('save-setting', { key: 'champion_pick_open', value: settings.champion_pick_open === 'true' ? 'false' : 'true' })" :style="{padding:'0.3rem 0.6rem', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:600, fontSize:'0.7rem', background: settings.champion_pick_open === 'true' ? '#ef4444' : '#16a34a', color:'white'}">
              {{ settings.champion_pick_open === 'true' ? 'DESHABILITAR' : 'HABILITAR' }}
            </button>
          </div>
        </div>
      </div>
      <div class="card">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
          <span style="font-size: 1.5rem;">📋</span>
          <div style="flex: 1;">
            <h3 class="form-label" style="font-size: 0.8rem; margin: 0;">LISTA DE PERMITIDOS</h3>
            <p style="font-size: 0.6rem; color: var(--color-gray); margin-top: 0.2rem;">
              Solo estos correos pueden ingresar. Vacío = todos pueden ingresar.
            </p>
          </div>
        </div>

        <div v-if="whitelist.length === 0" style="padding:0.5rem;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;text-align:center;font-size:0.75rem;color:var(--color-red);margin-bottom:0.5rem;">
          ⚠️ Agrega al menos un email — sin emails configurados, NADIE puede ingresar
        </div>

        <div v-for="(email, i) in whitelist" :key="i" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:0.85rem;">
          <span style="flex:1;">✉️ {{ email }}</span>
          <button @click="removeFromWhitelist(email)" :disabled="whitelist.length <= 1" :title="whitelist.length <= 1 ? 'Debe haber al menos 1 email permitido' : 'Eliminar'" style="background:none;border:none;color:var(--color-red);cursor:pointer;font-size:1rem;padding:0 0.25rem;opacity:whitelist.length <= 1 ? 0.4 : 1;">✕</button>
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
          <input type="email" v-model="whitelistInput" @keyup.enter="addToWhitelist" placeholder="correo@ejemplo.com" class="form-input" style="flex:1;padding:0.4rem 0.5rem;font-size:0.8rem;">
          <button class="btn btn-primary" :disabled="!whitelistInput || !whitelistInput.includes('@')" @click="addToWhitelist" style="padding:0.4rem 0.8rem;font-size:0.75rem;">AGREGAR</button>
        </div>
        <span v-if="whitelistSaved" style="color:var(--color-green);font-size:0.75rem;margin-top:0.3rem;display:block;">✅ Guardado</span>
      </div>

      <!-- Finish Modal -->
      <div v-if="showFinishModal && finishMatchData" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;" @click.self="showFinishModal = false">
        <div style="background:white;border-radius:16px;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">🏁</div>
            <h3 style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 0.25rem;">FINALIZAR PARTIDO</h3>
            <p style="font-size:0.75rem;color:var(--color-gray);margin:0;">Se cerrará el marcador y se calcularán los puntos.</p>
          </div>
          <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);border-radius:12px;padding:1rem;margin-bottom:1.25rem;border:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.75rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1;justify-content:flex-end;">
                <span style="font-weight:700;font-size:0.9rem;text-align:right;">{{ finishMatchData.home_team }}</span>
                <img v-if="finishMatchData.home_flag_url" :src="finishMatchData.home_flag_url" alt="" style="width:28px;height:20px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <span v-else style="font-size:1.5rem;">{{ finishMatchData.home_flag }}</span>
              </div>
              <span style="font-size:0.75rem;color:var(--color-gray);font-weight:600;">VS</span>
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1;">
                <img v-if="finishMatchData.away_flag_url" :src="finishMatchData.away_flag_url" alt="" style="width:28px;height:20px;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <span v-else style="font-size:1.5rem;">{{ finishMatchData.away_flag }}</span>
                <span style="font-weight:700;font-size:0.9rem;">{{ finishMatchData.away_team }}</span>
              </div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:2.25rem;font-weight:800;color:var(--color-dark);background:white;display:inline-block;padding:0.6rem 1.75rem;border-radius:10px;border:2px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                {{ finishMatchData.home_score ?? '?' }} - {{ finishMatchData.away_score ?? '?' }}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="showFinishModal = false" style="flex:1;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">CANCELAR</button>
            <button @click="confirmFinish" style="flex:1;padding:0.75rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">FINALIZAR</button>
          </div>
        </div>
      </div>

      <div class="card" style="background: #fffbeb; border: 1px solid #fcd34d;">
        <p style="font-size: 0.75rem; color: #92400e;">
          ⚠️ <strong>ADMIN:</strong> 💾 guarda el score sin cerrar el partido. 🏁 finaliza y activa el cálculo de puntos.
        </p>
      </div>

      <!-- Award Champion Modal -->
      <div v-if="showAwardModal && awardConfirmWinner" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;" @click.self="cancelAward">
        <div style="background:white;border-radius:16px;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">👑</div>
            <h3 style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 0.25rem;">OTORGAR PUNTOS DE CAMPEÓN</h3>
            <p style="font-size:0.75rem;color:var(--color-gray);margin:0;">Esta acción es irreversible. Se otorgarán +5 pts a quienes hayan elegido a este campeón.</p>
          </div>
          <div style="background:linear-gradient(135deg, #fef3c7 0%, #f8fafc 100%);border-radius:12px;padding:1rem;margin-bottom:1.25rem;border:1px solid #fcd34d;text-align:center;">
            <div style="font-size:0.7rem;color:#92400e;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">CAMPEÓN MUNDIAL 2026</div>
            <div style="font-family:var(--font-header);font-size:1.75rem;color:var(--color-dark);">{{ awardConfirmWinner }}</div>
            <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--color-gray);">+5 puntos para cada usuario que acertó</div>
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="cancelAward" style="flex:1;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">CANCELAR</button>
            <button @click="confirmAward" style="flex:1;padding:0.75rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">OTORGAR +5 PTS</button>
          </div>
        </div>
      </div>
    </div>
  `
};
