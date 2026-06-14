import { roundLabel, formatDate, flagUrl, todayStr as todayStrLocal, addDaysStr as addDaysStrLocal, nowStr } from '../utils/helpers.js';
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
      showChampionModal: false,
      championConfirmData: null,
      groups: [],
      groupsLoading: true,
      showGroupsPanel: false,
      expandedGroup: null,
      expandedMatch: null,
      matchStats: null,
    };
  },
  async mounted() {
    await this.loadGroups();
  },
  computed: {
    championDeadlinePassed() {
      const now = new Date();
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
    championConfirmFlagUrl() {
      if (!this.championConfirmData) return '';
      const c = this.countries.find(x => x.name === this.championConfirmData);
      return c ? flagUrl(c.flag) : '';
    },
    selectedGroup() {
      if (!this.expandedGroup || !this.groups.length) return null;
      return this.groups.find(g => g.group === this.expandedGroup) || null;
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
        g.matches.some(m => this.canPredict(m) && !this.predictions[m.id]?.id && this.predictions[m.id]?.home != null && this.predictions[m.id]?.away != null)
      );
    },
    getPoints(match) {
      const p = this.predictions[match.id];
      if (!p || match.status !== 'finished') return null;
      return p.points ?? null;
    },
    potentialPoints(match) {
      const p = this.predictions[match.id];
      if (!p?.id) return null;
      const hs = Number(match.home_score);
      const as = Number(match.away_score);
      if (isNaN(hs) || isNaN(as)) return null;
      if (match.status === 'finished') return null;
      const ph = Number(p.home);
      const pa = Number(p.away);
      if (isNaN(ph) || isNaN(pa)) return null;
      let pts = 0;
      if (ph === hs && pa === as) {
        pts = 3;
      } else {
        const pd = ph - pa;
        const rd = hs - as;
        if ((pd === rd && rd === 0) || (pd > 0 && rd > 0) || (pd < 0 && rd < 0)) {
          pts = 1;
        }
      }
      return p.comodin ? pts * 2 : pts;
    },
    canShowPotential(match) {
      return this.potentialPoints(match) !== null;
    },
    groupPoints(group) {
      return group.matches.reduce((sum, m) => {
        if (m.status !== 'finished' || m.home_score == null || m.away_score == null) return sum;
        const p = this.predictions[m.id];
        if (!p?.id) return sum;
        const pts = this.getPoints(m);
        return sum + (pts || 0);
      }, 0);
    },
    ptsClass(match) {
      const pts = this.getPoints(match);
      if (pts === null) return '';
      if (pts >= 3) return 'exact';
      if (pts > 0) return 'winner';
      return 'wrong';
    },
    shareChampion(e) {
      e.stopPropagation();
      const name = this.championPickLabel || this.championPick?.champion || '';
      const flag = this.championPickFlagUrl || '🏆';
      const user = this.user || {};
      const msg = `🏆 CAMPEÓN MUNDIAL 2026\n\n${name} 🏆\n\nPronosticado por: ${user.name || ''}\n${user.email || ''}`;
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    },
    async saveChampionPick() {
      if (!this.championSelected) return;
      this.championConfirmData = this.championSelected;
      this.showChampionModal = true;
    },
    confirmChampionPick() {
      if (!this.championConfirmData) return;
      this.showChampionModal = false;
      api.post('/champion-picks', { champion: this.championConfirmData })
        .then(() => {
          this.$emit('saved');
        })
        .catch(e => {
          this.$emit('save-error', e.message || 'Error al guardar');
        });
      this.championConfirmData = null;
    },
    cancelChampionPick() {
      this.showChampionModal = false;
      this.championConfirmData = null;
    },
    async toggleMatchStats(matchId) {
      if (this.expandedMatch === matchId) {
        this.expandedMatch = null;
        this.matchStats = null;
        return;
      }
      try {
        const predictions = await api.get(`/predictions/match/${encodeURIComponent(matchId)}`);
        const total = predictions.length;
        const homeWins = predictions.filter(p => Number(p.home_score) > Number(p.away_score)).length;
        const draws = predictions.filter(p => Number(p.home_score) === Number(p.away_score)).length;
        const awayWins = predictions.filter(p => Number(p.home_score) < Number(p.away_score)).length;
        const scoreCounts = {};
        predictions.forEach(p => {
          const key = `${p.home_score}-${p.away_score}`;
          scoreCounts[key] = (scoreCounts[key] || 0) + 1;
        });
        const topScores = Object.entries(scoreCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        this.matchStats = { total, homeWins, draws, awayWins, topScores, predictions };
        this.expandedMatch = matchId;
      } catch (_) {
        this.matchStats = { total: 0, homeWins: 0, draws: 0, awayWins: 0, topScores: [], predictions: [] };
        this.expandedMatch = matchId;
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
    async loadGroups() {
      try {
        this.groups = await api.get('/groups/standings');
        if (this.groups.length > 0) this.expandedGroup = this.groups[0].group;
      } catch (_) { this.groups = []; }
      this.groupsLoading = false;
    },
    teamFlag(name) {
      const c = this.countries.find(x => x.name === name);
      return c ? flagUrl(c.flag) : '';
    },
    toggleGroup(label) {
      this.expandedGroup = this.expandedGroup === label ? null : label;
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
        <span class="banner-icon">⚽</span>
        <div>
          <h2 class="banner-title">¡BIENVENIDO!</h2>
          <p class="banner-subtitle">Realiza tus pronósticos y suma puntos</p>
        </div>
      </div>

      <!-- Champion Pick (Siempre Arriba) -->
      <div class="card" style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; padding: 1.25rem;">
        <div class="stat-icon" style="width: 48px; height: 48px; background: #fffcf0; border: 1px solid #fee2e2; border-radius: 12px; font-size: 2rem; display:flex; align-items:center; justify-content:center;">🏆</div>
        <div style="flex: 1;">
          <h3 class="stat-label" style="margin-bottom: 0.25rem; color: var(--color-dark); font-size:0.85rem; font-weight:700;">PRONÓSTICO DEL CAMPEÓN</h3>
          
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
            <div style="display: flex; gap: 0.5rem; align-items: center; max-width: 480px;">
              <select v-model="championSelected" style="flex: 1; padding: 0.65rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: var(--font-main); font-size: 0.9rem; background: #f8fafc; color: var(--color-dark); cursor: pointer;">
                 <option value="">Seleccionar...</option>
                 <option v-for="c in countries" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <button class="btn btn-primary" @click="saveChampionPick" :disabled="!championSelected" style="padding: 0 1.25rem; font-family: var(--font-header); font-size: 1rem; border-radius: 8px; letter-spacing: 0.05em; height: 38px;">GUARDAR</button>
            </div>
          </template>

          <!-- STATE 3: COMING SOON -->
          <template v-else-if="!championDeadlinePassed">
            <p style="font-size: 0.65rem; color: var(--color-gray); margin-bottom: 0.75rem; font-family: var(--font-main);">La selección del campeón se habilitará pronto según las reglas del admin.</p>
            <div style="padding: 0.75rem; background: #f1f5f9; border-radius: 8px; text-align: center; color: #64748b; font-size: 0.85rem; font-family: var(--font-header); letter-spacing: 0.05em; opacity: 0.7; max-width: 300px;">
              ⏳ PRÓXIMAMENTE
            </div>
          </template>

          <!-- STATE 4: CLOSED BY RULES -->
          <template v-else>
            <p style="font-size: 0.65rem; color: #ef4444; margin-bottom: 0.75rem; font-family: var(--font-main); font-weight: 500;">La fecha límite para el pronóstico del campeón ya pasó.</p>
            <div style="padding: 0.75rem; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; text-align: center; color: #991b1b; font-size: 0.85rem; font-family: var(--font-header); letter-spacing: 0.05em; max-width: 400px;">
              🚫 TE PERDISTE EL PRONÓSTICO DEL CAMPEÓN
            </div>
          </template>
        </div>
      </div>

      <!-- Group Standings (Siempre Arriba) -->
      <div class="card" style="padding: 0.75rem; margin-bottom: 1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" @click="showGroupsPanel = !showGroupsPanel; if(showGroupsPanel && groups.length) expandedGroup = groups[0].group">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:1.2rem;">#</span>
            <span style="font-weight:700;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.02em;">TABLA DE GRUPOS</span>
          </div>
          <span style="font-size:0.85rem;color:var(--color-gray);transition:transform 0.2s;" :style="{transform: showGroupsPanel ? 'rotate(180deg)' : ''}">▼</span>
        </div>
        <div v-if="showGroupsPanel" style="margin-top:0.75rem;">
          <div v-if="groupsLoading" style="text-align:center;padding:0.5rem;font-size:0.75rem;color:var(--color-gray);">Cargando grupos...</div>
          <div v-else-if="groups.length === 0" style="text-align:center;padding:0.5rem;font-size:0.75rem;color:var(--color-gray);">No hay datos de grupos</div>
          <template v-else>
            <!-- Carousel de grupos -->
            <div style="display:flex;gap:0.4rem;overflow-x:auto;padding-bottom:0.5rem;margin-bottom:0.75rem;scrollbar-width:thin;-webkit-overflow-scrolling:touch;">
              <button v-for="g in groups" :key="g.group" @click="expandedGroup = g.group"
                :style="{flex:'0 0 auto', padding:'0.35rem 0.7rem', border:'1.5px solid', borderRadius:'8px', cursor:'pointer', fontWeight: expandedGroup === g.group ? 800 : 600, fontSize:'0.75rem', background: expandedGroup === g.group ? 'var(--color-dark)' : 'white', color: expandedGroup === g.group ? 'white' : 'var(--color-dark)', borderColor: expandedGroup === g.group ? 'var(--color-dark)' : '#d1d5db', transition:'all 0.15s'}">
                GRUPO {{ g.group }}
              </button>
            </div>
            <!-- Tabla del grupo seleccionado -->
            <div v-if="expandedGroup && selectedGroup" style="border:1px solid rgba(0,0,0,0.06);border-radius:8px;overflow:hidden;">
              <div style="padding:0.4rem 0.6rem;background:var(--color-dark);color:white;font-size:0.75rem;font-weight:700;">GRUPO {{ selectedGroup.group }}</div>
              <div style="padding:0.4rem;">
                  <table style="width:100%;border-collapse:collapse;font-size:0.65rem;">
                    <thead>
                      <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                        <th style="padding:0.25rem 0.3rem;text-align:left;color:var(--color-gray);width:24px;">#</th>
                        <th style="padding:0.25rem 0.3rem;text-align:left;color:var(--color-gray);">EQUIPO</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">PJ</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">PG</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">PE</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">PP</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">GF</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;color:var(--color-gray);">GC</th>
                        <th style="padding:0.25rem 0.3rem;text-align:center;font-weight:800;color:var(--color-gray);">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(t, i) in selectedGroup.teams" :key="t.name" :style="{background: i < 2 ? 'rgba(22,163,74,0.04)' : '', fontWeight: i < 2 ? 700 : 400, borderBottom: '1px solid rgba(0,0,0,0.03)'}">
                        <td style="padding:0.3rem 0.3rem;text-align:left;">{{ i + 1 }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:left;white-space:nowrap;">
                          <img v-if="teamFlag(t.name)" :src="teamFlag(t.name)" alt="" style="width:20px;height:14px;border-radius:2px;vertical-align:middle;margin-right:0.25rem;">
                          {{ t.name }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.pj }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.pg }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.pe }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.pp }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.gf }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;">{{ t.gc }}</td>
                        <td style="padding:0.3rem 0.3rem;text-align:center;font-weight:800;color:var(--color-dark);">{{ t.pts }}</td>
                      </tr>
                  </tbody>
                </table>
              </div>
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

      <div v-if="filteredGroups.length === 0" class="card" style="text-align:center;padding:2rem;color:var(--color-gray);">
        No hay partidos programados para este día.
      </div>

      <div v-for="group in filteredGroups" :key="group.date" class="date-section">
        <div class="date-header">
          <span>{{ formatDate(group.date) }}</span>
          <span v-if="groupPoints(group) > 0" style="display:flex;align-items:center;gap:0.35rem;">
            <span style="background:var(--color-accent);color:var(--color-dark);padding:0.15rem 0.5rem;border-radius:4px;font-family:var(--font-main);font-size:0.7rem;font-weight:800;letter-spacing:0.03em;">{{ groupPoints(group) }} PTS</span>
          </span>
          <span v-else-if="group.matches.some(m => m.status === 'finished')" style="display:flex;align-items:center;gap:0.35rem;">
            <span style="background:#e2e8f0;color:#64748b;padding:0.15rem 0.5rem;border-radius:4px;font-family:var(--font-main);font-size:0.7rem;font-weight:700;">0 PTS</span>
          </span>
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
                  @keypress="onlyDigits" @paste.prevent
                  :disabled="!canPredict(match)"
                  inputmode="numeric">
                <span>-</span>
                <input type="text" class="input-score"
                  :value="predictions[match.id]?.away"
                  @input="$emit('set-score', match.id, 'away', $event.target.value)"
                  @focus="$event.target.select()"
                  @keypress="onlyDigits" @paste.prevent
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

          <div v-if="match.status === 'finished'" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);border-radius:6px;padding-left:0.5rem;padding-right:0.5rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex:1;justify-content:center;">
              <span style="font-size:0.6rem;font-weight:700;color:var(--color-gray);letter-spacing:0.08em;">RESULTADO</span>
              <span style="font-size:1.4rem;font-weight:900;color:var(--color-dark);background:white;padding:0.1rem 0.7rem;border-radius:6px;border:1px solid #e2e8f0;box-shadow:0 2px 6px rgba(0,0,0,0.06);">{{ match.home_score }} - {{ match.away_score }}</span>
            </div>
            <span v-if="predictions[match.id]?.id" class="pts-badge" :class="ptsClass(match)" style="font-size:0.85rem;">{{ getPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }}</span>
            <span v-else class="pts-badge wrong">0 PTS</span>
          </div>
          <div v-if="isMatchPast(match) && match.status !== 'finished'" style="display:flex;justify-content:flex-end;align-items:center;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(0,0,0,0.06);">
            <span v-if="potentialPoints(match) !== null" class="pts-badge pts-potential" style="font-size:0.85rem;animation:pulse 1.5s infinite;">{{ potentialPoints(match) }} PTS {{ predictions[match.id]?.comodin ? '🍀' : '' }} ⏳</span>
            <span v-else-if="predictions[match.id]?.id" style="font-size:0.7rem;color:var(--color-gray);font-style:italic;">Esperando resultado...</span>
          </div>

          <button @click="toggleMatchStats(match.id)" style="width:100%;margin-top:0.4rem;padding:0.25rem;border:none;border-radius:4px;background:rgba(0,0,0,0.03);color:var(--color-gray);font-size:0.6rem;cursor:pointer;font-weight:600;transition:background 0.2s;" @mouseover="$event.target.style.background='rgba(0,0,0,0.07)'" @mouseout="$event.target.style.background='rgba(0,0,0,0.03)'">
            👥 {{ expandedMatch === match.id ? 'OCULTAR' : 'VER PRONÓSTICOS' }}
          </button>

          <div v-if="expandedMatch === match.id && matchStats" style="margin-top:0.4rem;padding:0.5rem;background:#f8fafc;border-radius:6px;font-size:0.7rem;border:1px solid rgba(0,0,0,0.06);">
            <div style="display:flex;gap:0.75rem;margin-bottom:0.5rem;text-align:center;">
              <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;">{{ matchStats.total }}</div><div style="color:var(--color-gray);font-size:0.6rem;">VOTOS</div></div>
              <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#16a34a;">{{ matchStats.homeWins }}</div><div style="color:var(--color-gray);font-size:0.6rem;"><img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:14px;height:10px;border-radius:1px;vertical-align:middle;"> GANA</div></div>
              <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#d4af37;">{{ matchStats.draws }}</div><div style="color:var(--color-gray);font-size:0.6rem;">EMPATE</div></div>
              <div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;color:#2563eb;">{{ matchStats.awayWins }}</div><div style="color:var(--color-gray);font-size:0.6rem;"><img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:14px;height:10px;border-radius:1px;vertical-align:middle;"> GANA</div></div>
            </div>
            <div v-if="matchStats.topScores.length > 0" style="border-top:1px solid rgba(0,0,0,0.06);padding-top:0.5rem;">
              <div style="font-size:0.6rem;font-weight:700;color:var(--color-gray);text-align:center;margin-bottom:0.35rem;">PRONÓSTICOS MÁS VOTADOS</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;">
                <div v-for="([score, count], i) in matchStats.topScores" :key="i" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:white;border:1px solid rgba(0,0,0,0.07);border-radius:6px;padding:0.4rem 0.3rem;text-align:center;">
                  <div style="font-weight:700;font-size:0.8rem;white-space:nowrap;">
                    <img v-if="match.home_flag_url" :src="match.home_flag_url" alt="" style="width:16px;height:11px;border-radius:2px;vertical-align:middle;">
                    {{ score }}
                    <img v-if="match.away_flag_url" :src="match.away_flag_url" alt="" style="width:16px;height:11px;border-radius:2px;vertical-align:middle;">
                  </div>
                  <div style="font-size:0.6rem;color:var(--color-gray);font-weight:600;">{{ count }} voto(s)</div>
                </div>
              </div>
            </div>
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

      <!-- Champion Confirm Modal -->
      <div v-if="showChampionModal && championConfirmData" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;" @click.self="cancelChampionPick">
        <div style="background:white;border-radius:16px;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">🏆</div>
            <h3 style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 0.25rem;">CONFIRMAR CAMPEÓN</h3>
            <p style="font-size:0.75rem;color:var(--color-gray);margin:0;">Solo podrás hacer esto UNA VEZ. No podrás cambiarlo después.</p>
          </div>
          <div style="background:linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);border-radius:12px;padding:1rem;margin-bottom:1.25rem;border:1px solid #bbf7d0;text-align:center;">
            <div style="font-size:0.7rem;color:#15803d;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">TU PRONÓSTICO</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;">
              <img v-if="championConfirmFlagUrl" :src="championConfirmFlagUrl" alt="" style="width:36px;height:24px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
              <span v-else style="font-size:2rem;">🏴</span>
              <span style="font-family:var(--font-header);font-size:1.5rem;color:var(--color-dark);">{{ championConfirmData }}</span>
            </div>
            <div style="margin-top:0.5rem;font-size:0.75rem;color:#15803d;font-weight:600;">Será el campeón del Mundial 2026 🏆</div>
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="cancelChampionPick" style="flex:1;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">CANCELAR</button>
            <button @click="confirmChampionPick" style="flex:1;padding:0.75rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">CONFIRMAR</button>
          </div>
        </div>
      </div>

      <!-- Confirm Modal -->
      <div v-if="showConfirmModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;" @click.self="closeModal">
        <div style="background:white;border-radius:16px;padding:1.5rem;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">📋</div>
            <h3 style="font-family:var(--font-header);font-size:1.25rem;margin:0 0 0.25rem;">CONFIRMAR ENVÍO</h3>
            <p style="font-size:0.75rem;color:var(--color-gray);margin:0;">Una vez enviados no podrás modificarlos.</p>
          </div>
          <div style="background:#f8fafc;border-radius:12px;padding:0.85rem;margin-bottom:1.25rem;max-height:240px;overflow-y:auto;border:1px solid #e2e8f0;">
            <div v-for="m in pendingMatches" :key="m.id" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:0.5rem;min-width:0;">
                <span style="font-weight:700;font-size:0.82rem;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ m.home_team }}</span>
                <img v-if="m.home_flag_url" :src="m.home_flag_url" alt="" style="width:26px;height:18px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.1);flex-shrink:0;">
                <span v-else style="font-size:1.3rem;flex-shrink:0;">{{ m.home_flag }}</span>
              </div>
              <div style="font-size:1.4rem;font-weight:800;color:var(--color-dark);background:white;padding:0.5rem 1rem;border-radius:10px;border:2px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.08);text-align:center;white-space:nowrap;">
                {{ predictions[m.id]?.home }} - {{ predictions[m.id]?.away }}
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-start;gap:0.5rem;min-width:0;">
                <img v-if="m.away_flag_url" :src="m.away_flag_url" alt="" style="width:26px;height:18px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.1);flex-shrink:0;">
                <span v-else style="font-size:1.3rem;flex-shrink:0;">{{ m.away_flag }}</span>
                <span style="font-weight:700;font-size:0.82rem;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ m.away_team }}</span>
              </div>
              <div v-if="predictions[m.id]?.comodin" style="grid-column:1/-1;text-align:center;font-size:0.7rem;font-weight:700;color:#d97706;background:#fef3c7;padding:0.15rem 0.4rem;border-radius:4px;">
                ⭐ COMODÍN ACTIVO
              </div>
            </div>
          </div>
          <div v-if="pendingMatches.some(m => predictions[m.id]?.comodin)" style="text-align:center;font-size:0.75rem;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:0.5rem;margin-bottom:0.75rem;">
            ⚠️ El comodín solo se podrá utilizar <strong>una vez</strong> en todo el torneo.
          </div>
          <div style="display:flex;gap:0.6rem;">
            <button @click="closeModal" style="flex:1;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;background:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">CANCELAR</button>
            <button @click="$emit('submit'); closeModal()" style="flex:1;padding:0.75rem;border:none;border-radius:8px;background:var(--color-dark);color:white;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">ACEPTAR</button>
          </div>
        </div>
      </div>
    </div>
  `
};
