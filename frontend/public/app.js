import { api } from './src/services/api.js';
import { logout, refreshAuth } from './src/services/auth.js';
import {
  loadMatches,
  loadPredictions,
  loadMatchPredictions,
  loadSettings,
  loadChampionPick,
  savePrediction,
  savePredictionsBatch,
  saveChampionPick,
  saveSetting
} from './src/services/game.js';
import { flagUrl } from './src/utils/helpers.js';
import { subscribeToPush } from './src/services/push.js';

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
      
      <Layout v-else :user="user" :current-view="view" :is-admin="isAdmin" :app-version="appVersion" :notification="notification" @change-view="view = $event" @logout="handleLogout" @clear-notification="notification.visible = false">
        <template v-if="view === 'votar'">
          <Matchlist
            :match-groups="matchGroups"
            :predictions="predictions"
            :user="user"
            :saving="saving"
            :comodin-usado="comodinUsado"
            :comodin-max="comodinMax"
            :countries="countries"
            :settings="settings"
            :champion-pick="championPick"
            :user-streak="userStreak"
            :user-rank="userRank"
            :user-rank-delta="userRankDelta"
            :pending-today-count="pendingTodayCount"
            @set-score="setScore"
            @toggle-comodin="toggleComodin"
            @submit="submitPredictions"
            @saved="handleChampionSaved"
            @save-error="handleChampionError" />
        </template>
        <template v-else-if="view === 'historial'">
          <Mypredictions
            :match-groups="historyGroups"
            :predictions="predictions"
            :all-matches="allMatches"
            :champion-pick="championPick"
            :user-streak="userStreak"
            :max-streak="maxStreak"
            :comodin-max="comodinMax" />
        </template>
        <template v-else-if="view === 'posiciones'">
          <Ranking
            :rankings-data="rankingsData"
            :rankings-loading="rankingsLoading"
            :all-matches="allMatches" />
        </template>
        <template v-else-if="view === 'admin' && isAdmin">
          <Admin
            :matches="allMatches"
            :settings="settings"
            :is-admin="isAdmin"
            :countries="countries"
            @save-score="saveScore"
            @finish-match="finishMatch"
            @add-match="addMatch"
            @delete-match="deleteMatch"
            @export-csv="exportToCSV"
            @export-match="exportMatchCSV"
            @save-setting="handleSaveSetting" />
        </template>
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
      comodinMax: 1,
    };
  },
  computed: {
    appVersion() { return window.APP_VERSION || '2.0.0'; },
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
      return Object.values(this.predictions).filter(p => p.comodin).length;
    },
    comodinesUsados() {
      return this.comodinUsado;
    },
    comodinesDisponibles() {
      return Math.max(0, this.comodinMax - this.comodinUsado);
    },
    userStreak() {
      const finished = this.allMatches
        .filter(m => m.status === 'finished' && this.predictions[m.id]?.id)
        .sort((a, b) => (a.date + ' ' + (a.time || '00:00')).localeCompare(b.date + ' ' + (b.time || '00:00')));
      let streak = 0;
      for (let i = finished.length - 1; i >= 0; i--) {
        const p = this.predictions[finished[i].id];
        if (p && (p.points || 0) > 0) streak++;
        else break;
      }
      return streak;
    },
    maxStreak() {
      const finished = this.allMatches
        .filter(m => m.status === 'finished' && this.predictions[m.id]?.id)
        .sort((a, b) => (a.date + ' ' + (a.time || '00:00')).localeCompare(b.date + ' ' + (b.time || '00:00')));
      let max = 0, current = 0;
      for (const m of finished) {
        const p = this.predictions[m.id];
        if (p && (p.points || 0) > 0) { current++; max = Math.max(max, current); }
        else current = 0;
      }
      return max;
    },
    userRank() {
      if (!this.rankingsData.length || !this.user) return null;
      const idx = this.rankingsData.findIndex(r => r.id === this.user.id);
      return idx === -1 ? null : idx + 1;
    },
    userRankDelta() {
      const current = this.userRank;
      if (!current || !this.user) return 0;
      try {
        const prev = parseInt(localStorage.getItem(`mundial_rank_${this.user.id}`) || '0', 10);
        if (!prev) return 0;
        return prev - current;
      } catch { return 0; }
    },
    pendingTodayCount() {
      const now = new Date();
      const todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      const nowStr = todayStr + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      return this.allMatches.filter(m => {
        if (m.status !== 'open') return false;
        if (m.date !== todayStr) return false;
        const matchDt = m.date + ' ' + (m.time || '00:00');
        if (matchDt < nowStr) return false;
        return !this.predictions[m.id]?.id;
      }).length;
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
      subscribeToPush();
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
        this.predictions[p.match] = { home: p.home_score, away: p.away_score, id: p.id, comodin: !!p.comodin, points: p.points ?? null };
      });
      this.settings = await loadSettings();
      this.championPick = await loadChampionPick();
      this.comodinMax = parseInt(this.settings.comodin_max_per_user, 10) || 1;
      this.rankingsData = await api.get('/users/rankings').catch(() => []);
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
      if (!p.comodin && this.comodinUsado >= this.comodinMax) return;
      this.predictions[matchId] = { ...p, comodin: !p.comodin };
    },
    async submitPredictions() {
      this.saving = true;
      this.authError = '';
      const items = [];
      for (const [matchId, p] of Object.entries(this.predictions)) {
        if (!p.id && p.home !== null && p.away !== null) {
          items.push({
            match: matchId,
            home_score: p.home,
            away_score: p.away,
            comodin: !!p.comodin
          });
        }
      }
      if (items.length === 0) {
        this.notify('No hay pronósticos nuevos para guardar');
        this.saving = false;
        return;
      }
      try {
        const result = await savePredictionsBatch(items);
        await this.loadAllData();
        const saved = result.saved.length;
        const errs = result.errors;
        if (errs.length === 0) {
          this.notify(`${saved} pronóstico(s) guardado(s)`);
        } else {
          this.notify(`Guardado ${saved}, falló ${errs.length}: ${errs[0].error || errs[0]}`, 'error');
        }
      } catch (e) {
        this.notify(e.message || 'Error al guardar pronósticos', 'error');
      }
      this.saving = false;
    },
    async loadRankings() {
      this.rankingsLoading = true;
      try {
        if (this.user && this.rankingsData.length) {
          const currentIdx = this.rankingsData.findIndex(r => r.id === this.user.id);
          if (currentIdx !== -1) {
            try { localStorage.setItem(`mundial_rank_${this.user.id}`, String(currentIdx + 1)); } catch (_) {}
          }
        }
        this.rankingsData = await api.get('/users/rankings');
      } catch (_) {
        this.rankingsData = [];
      }
      this.rankingsLoading = false;
    },
    async saveScore(match) {
      try {
        await api.patch('/matches/' + match.id, {
          home_score: match.home_score,
          away_score: match.away_score,
        });
        this.notify('Score guardado');
      } catch (e) {
        this.notify(e.message || 'Error al guardar', 'error');
      }
    },
    async finishMatch(match) {
      try {
        await api.patch('/matches/' + match.id, {
          home_score: match.home_score,
          away_score: match.away_score,
          status: 'finished'
        });
        this.notify('Partido finalizado');
        await this.loadAllData();
      } catch (e) {
        this.notify(e.message || 'Error al finalizar', 'error');
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
    async handleChampionSaved() {
      try {
        await this.loadAllData();
        this.notify('Campeón registrado correctamente ¡Suerte!', 'success');
      } catch (e) {
        this.notify('Error al cargar datos', 'error');
      }
    },
    async handleChampionError(msg) {
      try {
        await this.loadAllData();
      } catch (_) {}
      this.notify(msg, 'error');
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
        csv += ['Usuario','Nombre','Fecha','Partido','Pronóstico Local','Pronóstico Visitante','Resultado Local','Resultado Visitante','Comodín','Puntos'].join(sep) + '\n';

        const sorted = records.slice().sort((a, b) => {
          const na = (a.expand?.user?.name || '').toLowerCase();
          const nb = (b.expand?.user?.name || '').toLowerCase();
          if (na !== nb) return na.localeCompare(nb);
          const da = a.expand?.match?.date || '';
          const db = b.expand?.match?.date || '';
          const ta = a.expand?.match?.time || '';
          const tb = b.expand?.match?.time || '';
          return (da + ta).localeCompare(db + tb);
        });

        sorted.forEach(r => {
          const m = r.expand?.match;
          const row = [
            r.expand?.user?.email || '?',
            r.expand?.user?.name || r.expand?.user?.email?.split('@')[0] || '?',
            m?.date ? m.date.split('-').reverse().join('/') : '?',
            m ? `${m.home_team} vs ${m.away_team}` : '?',
            r.home_score,
            r.away_score,
            m?.home_score ?? '',
            m?.away_score ?? '',
            r.comodin ? 'Sí' : 'No',
            r.points ?? '',
          ];
          csv += row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep) + '\n';
        });

        const now = new Date();
        this._downloadCSV(csv, `predicciones_mundial_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.csv`);
        this.notify(`Exportados ${records.length} pronósticos`, 'success');
      } catch (e) {
        this.notify('Error al exportar: ' + e.message, 'error');
      }
    },
    async exportMatchCSV(match) {
      try {
        const [records, allUsers] = await Promise.all([
          loadMatchPredictions(match.id),
          api.get('/users')
        ]);
        const BOM = '\uFEFF';
        const sep = ',';
        let csv = BOM;
        csv += ['Usuario','Nombre','Pronóstico Local','Pronóstico Visitante','Resultado Local','Resultado Visitante','Comodín','Puntos'].join(sep) + '\n';

        const predUserIds = new Set(records.map(r => r.user));
        const rows = [];
        for (const u of allUsers) {
          const pred = records.find(r => r.user === u.id);
          rows.push({
            email: u.email,
            name: u.name || u.email.split('@')[0],
            home_score: pred ? pred.home_score : '',
            away_score: pred ? pred.away_score : '',
            comodin: pred ? pred.comodin : false,
            points: pred ? (pred.points ?? 0) : 0,
          });
        }
        rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        rows.forEach(r => {
          const row = [
            r.email,
            r.name,
            r.home_score,
            r.away_score,
            match.home_score ?? '',
            match.away_score ?? '',
            r.comodin ? 'Sí' : 'No',
            r.points,
          ];
          csv += row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep) + '\n';
        });

        const matchName = `${match.home_team.replace(/\s/g,'_')}_vs_${match.away_team.replace(/\s/g,'_')}`;
        const realScore = `${match.home_score ?? '?'}-${match.away_score ?? '?'}`;
        this._downloadCSV(csv, `${matchName}_${realScore}.csv`);
        this.notify(`Exportado ${rows.length} pronósticos de ${match.home_team} vs ${match.away_team}`, 'success');
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

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.user) {
        subscribeToPush();
      }
    });

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        const d = event.data.data;
        const nd = d.data || {};
        if (this.notificationTimer) clearTimeout(this.notificationTimer);
        if (nd.homeTeam) {
          this.notification = {
            type: 'success',
            visible: true,
            match: true,
            homeTeam: nd.homeTeam,
            awayTeam: nd.awayTeam,
            homeScore: nd.homeScore,
            awayScore: nd.awayScore,
            homeFlagUrl: nd.homeFlagUrl || d.icon,
            awayFlagUrl: nd.awayFlagUrl || d.badge,
            body: nd.body || d.body,
          };
        } else {
          this.notification = {
            visible: true,
            type: 'success',
            message: d.title + ' — ' + d.body,
            flagUrl: nd.flagUrl || d.icon,
          };
        }
        this.notificationTimer = setTimeout(() => {
          this.notification.visible = false;
        }, 5000);
      }
    });
    
    this.user = await refreshAuth();
    if (this.user) {
      await this.loadAllData();
      subscribeToPush();
    }
    this.loading = false;
  }
}).mount('#app');
