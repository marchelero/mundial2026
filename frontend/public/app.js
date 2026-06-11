import { api } from './src/services/api.js';
import { logout, refreshAuth } from './src/services/auth.js';
import {
  loadMatches,
  loadPredictions,
  loadMatchPredictions,
  loadSettings,
  loadChampionPick,
  savePrediction,
  saveChampionPick,
  saveSetting,
  loadAllRankings
} from './src/services/game.js';
import { calcPoints, flagUrl } from './src/utils/helpers.js';

import Login from './src/components/Login.js';
import Layout from './src/components/Layout.js';
import MatchList from './src/components/MatchList.js';
import Ranking from './src/components/Ranking.js';
import Admin from './src/components/Admin.js';
import MyPredictions from './src/components/MyPredictions.js';

const { createApp } = Vue;

createApp({
  components: {
    Login,
    Layout,
    Matchlist: MatchList,
    Mypredictions: MyPredictions,
    Ranking,
    Admin
  },
  template: `
    <div v-if="loading" class="loading-screen" style="display: flex; align-items: center; justify-content: center; height: 100vh;">
      <p style="font-family: var(--font-brush); font-size: 1.5rem;">Cargando...</p>
    </div>

    <template v-else>
      <Login v-if="!user" :auth-error="authError" />
      
      <Layout v-else :user="user" :current-view="view" :is-admin="isAdmin" :notification="notification" @change-view="view = $event" @logout="handleLogout" @clear-notification="notification.visible = false">
        <transition name="fade" mode="out-in">
          <Matchlist v-if="view === 'votar'" 
            :match-groups="matchGroups" 
            :predictions="predictions" 
            :user="user" 
            :saving="saving"
            :comodin-usado="comodinUsado"
            :countries="countries"
            :settings="settings"
            :champion-pick="championPick"
            @set-score="setScore"
            @toggle-comodin="toggleComodin"
            @submit="submitPredictions"
            @save-champion-pick="handleSaveChampionPick" />
            
          <Mypredictions v-else-if="view === 'historial'"
            :match-groups="historyGroups"
            :predictions="predictions"
            :all-matches="allMatches" />

          <Ranking v-else-if="view === 'posiciones'"
            :rankings-data="rankingsData"
            :rankings-loading="rankingsLoading"
            :all-matches="allMatches" />

          <Admin v-else-if="view === 'admin' && isAdmin"
            :matches="allMatches"
            :settings="settings"
            :is-admin="isAdmin"
            :countries="countries"
            @save-score="saveActualScore"
            @add-match="addMatch"
            @delete-match="deleteMatch"
            @export-csv="exportToCSV"
            @export-match="exportMatchCSV"
            @save-setting="handleSaveSetting" />
        </transition>
      </Layout>
    </template>
  `,
  data() {
    return {
      loading: true, authError: '', user: null,
      view: 'votar', allMatches: [], predictions: {},
      saving: false, championPick: { champion: '' },
      settings: {}, rankingsData: [], rankingsLoading: false,
      countries: typeof PAISES_MUNDIAL2026 !== 'undefined' ? PAISES_MUNDIAL2026 : [],
      notification: { message: '', type: 'success', visible: false },
      notificationTimer: null,
    };
  },
  computed: {
    isAdmin() {
      const email = this.user?.email || '';
      return (typeof ADMIN_EMAILS !== 'undefined' ? ADMIN_EMAILS : [])
        .some(e => e.toLowerCase() === email.toLowerCase());
    },
    matchGroups() { return this._groupMatches(this.allMatches); },
    historyGroups() {
      const hasPred = id => this.predictions[id]?.id;
      const now = new Date();
      const nowStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      const groups = this._groupMatches(this.allMatches.filter(m => {
        const matchDt = m.date + ' ' + (m.time || '00:00');
        const isFuture = matchDt >= nowStr;
        return !(m.status === 'open' && !hasPred(m.id) && isFuture);
      }));
      groups.forEach(g => g.matches.sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00')));
      return groups.sort((a, b) => b.date.localeCompare(a.date));
    },
    comodinUsado() {
      return Object.values(this.predictions).some(p => p.comodin);
    }
  },
  watch: {
    async view(newView) {
      if (newView === 'posiciones') {
        await this.loadRankings();
      }
    }
  },
  methods: {
    notify(message, type = 'success') {
      if (this.notificationTimer) clearTimeout(this.notificationTimer);
      this.notification = { message, type, visible: true };
      this.notificationTimer = setTimeout(() => {
        this.notification.visible = false;
      }, 4000);
    },
    async handleLoginSuccess(user) {
      this.loading = true;
      this.user = user;
      this.view = 'votar';
      await this.loadAllData();
      this.loading = false;
    },
    async handleLogout() {
      logout();
      this.user = null;
    },
    async loadAllData() {
      if (!this.user) return;
      this.allMatches = (await loadMatches()).map(m => {
        const country = this.countries.find(c => c.name === m.home_team);
        const countryAway = this.countries.find(c => c.name === m.away_team);
        const homeFlag = country?.flag || '🏴';
        const awayFlag = countryAway?.flag || '🏴';
        return {
          ...m,
          home_flag: homeFlag,
          home_flag_url: flagUrl(homeFlag),
          away_flag: awayFlag,
          away_flag_url: flagUrl(awayFlag),
        };
      });
      const preds = await loadPredictions(this.user.id);
      this.predictions = {};
      preds.forEach(p => {
        this.predictions[p.match] = { home: p.home_score, away: p.away_score, id: p.id, comodin: !!p.comodin };
      });
      this.settings = await loadSettings();
      this.championPick = await loadChampionPick();
    },
    setScore(matchId, side, val) {
      if (!this.predictions[matchId]) this.predictions[matchId] = { home: null, away: null };
      let num = val === '' ? null : Number(val);
      if (num !== null && num < 0) num = 0;
      if (num !== null && num > 30) num = 30;
      this.predictions[matchId][side] = num;
    },
    toggleComodin(matchId) {
      const p = this.predictions[matchId] || { home: null, away: null };
      if (this.comodinUsado && !p.comodin) return;
      this.predictions[matchId] = { ...p, comodin: !p.comodin };
    },
    async submitPredictions() {
      this.saving = true;
      this.authError = '';
      const errors = [];
      let saved = 0;
      for (const [matchId, p] of Object.entries(this.predictions)) {
        if (!p.id && p.home !== null && p.away !== null) {
          try {
            await savePrediction({
              match: matchId,
              home_score: p.home,
              away_score: p.away,
              comodin: !!p.comodin
            });
            saved++;
          } catch (e) {
            errors.push(e.message || 'Error');
          }
        }
      }
      await this.loadAllData();
      if (errors.length === 0) {
        this.notify(saved > 0 ? `${saved} pronóstico(s) guardado(s)` : 'No hay pronósticos nuevos para guardar');
      } else {
        this.notify(saved > 0 ? `Guardado ${saved}, falló ${errors.length}: ${errors[0]}` : errors[0], 'error');
      }
      this.saving = false;
    },
    async loadRankings() {
      this.rankingsLoading = true;
      const finished = this.allMatches.filter(m => m.status === 'finished');
      const { records, champPicks } = await loadAllRankings();

      const pointsMap = {};
      const userMap = {};

      records.forEach(p => {
        const uid = p.user;
        const match = finished.find(m => m.id === p.match);
        const pts = calcPoints({ home_score: p.home_score, away_score: p.away_score, comodin: p.comodin }, match);
        pointsMap[uid] = (pointsMap[uid] || 0) + (pts || 0);
        userMap[uid] = p.expand?.user || { email: uid, name: uid };
      });

      this.rankingsData = Object.entries(pointsMap)
        .map(([id, pts]) => ({
          id,
          name: userMap[id]?.name || userMap[id]?.email?.split('@')[0] || id,
          email: userMap[id]?.email || '',
          points: pts
        }))
        .sort((a, b) => b.points - a.points);

      this.rankingsLoading = false;
    },
    async saveActualScore(match) {
      try {
        await api.patch('/matches/' + match.id, {
          home_score: match.home_score,
          away_score: match.away_score,
          status: 'finished'
        });
        this.notify('Resultado guardado');
        await this.loadAllData();
      } catch (e) {
        this.notify(e.message || 'Error al guardar', 'error');
      }
    },
    async addMatch(newMatch) {
      try {
        await api.post('/matches', newMatch);
        this.notify('Partido registrado con éxito');
        await this.loadAllData();
      } catch (e) {
        this.notify(e.message || 'Error al registrar partido', 'error');
      }
    },
    async deleteMatch(id) {
      if (!confirm('¿Estás seguro de eliminar este partido?')) return;
      try {
        await api.delete('/matches/' + id);
        await this.loadAllData();
      } catch (e) {
        this.notify(e.message || 'Error al eliminar', 'error');
      }
    },
    async handleSaveChampionPick(champion) {
      if (!confirm('¿Estás seguro de que "' + champion + '" será el campeón?\n\nATENCIÓN: Solo podrás hacer esto UNA VEZ. No podrás cambiarlo después.')) return;
      try {
        await saveChampionPick(champion);
        await this.loadAllData();
        this.notify('Campeón registrado correctamente ¡Suerte!', 'success');
      } catch (e) {
        this.notify(e.message || 'Error al guardar campeón', 'error');
      }
    },
    async handleSaveSetting({ key, value }) {
      try {
        await saveSetting(key, value);
        this.settings = await loadSettings();
        this.notify('Configuración actualizada');
      } catch (e) {
        this.notify(e.message || 'Error al guardar configuración', 'error');
      }
    },
    async exportToCSV() {
      try {
        const records = await api.get('/predictions/export');

        const BOM = '\uFEFF';
        const sep = ',';
        let csv = BOM;
        csv += ['Usuario','Nombre','Partido','Pronóstico Local','Pronóstico Visitante','Resultado Local','Resultado Visitante','Comodín','Puntos'].join(sep) + '\n';

        records.forEach(r => {
          const m = r.expand?.match;
          const row = [
            r.expand?.user?.email || '?',
            r.expand?.user?.name || r.expand?.user?.email?.split('@')[0] || '?',
            m ? `${m.home_team} vs ${m.away_team}` : '?',
            r.home_score,
            r.away_score,
            m?.home_score ?? '',
            m?.away_score ?? '',
            r.comodin ? 'Sí' : 'No',
            calcPoints({ home_score: r.home_score, away_score: r.away_score, comodin: r.comodin }, m) ?? '',
          ];
          csv += row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep) + '\n';
        });

        this._downloadCSV(csv, `predicciones_mundial_${new Date().toISOString().split('T')[0]}.csv`);
        this.notify(`Exportados ${records.length} pronósticos`, 'success');
      } catch (e) {
        this.notify('Error al exportar: ' + e.message, 'error');
      }
    },
    async exportMatchCSV(match) {
      try {
        const records = await loadMatchPredictions(match.id);
        if (records.length === 0) {
          this.notify('No hay predicciones para este partido.', 'error');
          return;
        }
        const BOM = '\uFEFF';
        const sep = ',';
        let csv = BOM;
        csv += ['Usuario','Nombre','Pronóstico Local','Pronóstico Visitante','Resultado Local','Resultado Visitante','Comodín','Puntos'].join(sep) + '\n';

        records.forEach(r => {
          const row = [
            r.expand?.user?.email || '?',
            r.expand?.user?.name || r.expand?.user?.email?.split('@')[0] || '?',
            r.home_score,
            r.away_score,
            match.home_score ?? '',
            match.away_score ?? '',
            r.comodin ? 'Sí' : 'No',
            calcPoints({ home_score: r.home_score, away_score: r.away_score, comodin: r.comodin }, match) ?? '',
          ];
          csv += row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep) + '\n';
        });

        const matchName = `${match.home_team.replace(/\s/g,'_')}_vs_${match.away_team.replace(/\s/g,'_')}`;
        const realScore = `${match.home_score ?? '?'}-${match.away_score ?? '?'}`;
        this._downloadCSV(csv, `${matchName}_${realScore}.csv`);
        this.notify(`Exportado ${records.length} pronósticos de ${match.home_team} vs ${match.away_team}`, 'success');
      } catch (e) {
        this.notify('Error al exportar: ' + e.message, 'error');
      }
    },
    _downloadCSV(csv, filename) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    _groupMatches(matches) {
      const groups = {};
      matches.forEach(m => {
        if (!groups[m.date]) groups[m.date] = { date: m.date, matches: [] };
        groups[m.date].matches.push(m);
      });
      Object.values(groups).forEach(g => {
        g.matches.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
      });
      return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
    }
  },
  async mounted() {
    // PWA: capturar el evento antes del login
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__DEFERRED_PROMPT = e;
    });
    window.addEventListener('appinstalled', () => {
      window.__DEFERRED_PROMPT = null;
    });

    window.addEventListener('google-login-success', (e) => {
      this.handleLoginSuccess(e.detail);
    });
    
    this.user = await refreshAuth();
    if (this.user) {
      await this.loadAllData();
    }
    this.loading = false;
  }
}).mount('#app');
