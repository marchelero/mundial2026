const { createApp } = Vue;

const pb = new PocketBase(window.location.origin);

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDateTime(dateStr, timeStr) {
  let d = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return new Date(d[1] + '-' + d[2] + '-' + d[3] + 'T' + (timeStr || '12:00'));
  d = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (d) return new Date(d[3] + '-' + d[2] + '-' + d[1] + 'T' + (timeStr || '12:00'));
  return null;
}
function calcPoints(pred, match) {
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) return null;
  if (pred.home_score == null || pred.away_score == null) return null;
  let pts = 0;
  if (pred.home_score === match.home_score && pred.away_score === match.away_score) { pts = 3; }
  else {
    const pd = pred.home_score - pred.away_score;
    const rd = match.home_score - match.away_score;
    if (pd === rd && rd === 0) pts = 1;
    else if ((pd > 0 && rd > 0) || (pd < 0 && rd < 0)) pts = 1;
  }
  return pred.comodin ? pts * 2 : pts;
}

createApp({
  data() {
    return {
      loading: true, authLoading: false, authError: '', user: null,
      view: 'votar', allMatches: [], predictions: {}, alert: '', alertType: 'info',
      saving: false, championPick: { champion: '' }, championLoading: false,
      settings: {}, rankingsData: [], rankingsLoading: false,
      countries: typeof PAISES_MUNDIAL2026 !== 'undefined' ? PAISES_MUNDIAL2026 : [],
      countryNames: typeof PAISES_NOMBRES !== 'undefined' ? PAISES_NOMBRES : [],
      matchForm: { date: todayStr(), time: '', home_team: '', away_team: '', round: '' },
      editingMatch: null, selectedExport: null, matchPredictions: [],
    };
  },
  computed: {
    isAdmin() {
      if (!this.user) return false;
      return (typeof ADMIN_EMAILS !== 'undefined' ? ADMIN_EMAILS : [])
        .some(e => e.toLowerCase() === (this.user.email || '').toLowerCase());
    },
    userName() { return this.user?.name || this.user?.email?.split('@')[0] || 'User'; },
    matchGroups() { return this._groupMatches(this.recentMatches); },
    historyGroups() { return this._groupMatches(this.historyMatches); },
    recentMatches() {
      const now = new Date();
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      return this.allMatches.filter(m => {
        const dt = parseDateTime(m.date, m.time);
        return !dt || dt >= new Date(yesterday.toDateString());
      });
    },
    historyMatches() {
      const now = new Date();
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      return this.allMatches.filter(m => {
        const dt = parseDateTime(m.date, m.time);
        return dt && dt < new Date(yesterday.toDateString());
      });
    },
    totalVoted() { return Object.values(this.predictions).filter(p => p.home !== null && p.away !== null).length; },
    hasPredictionsToSubmit() { return Object.values(this.predictions).some(p => p.home !== null && p.away !== null && !p.id); },
    hasSavedPredictions() { return Object.values(this.predictions).some(p => p.id); },
    sortedAdminMatches() { return [...this.allMatches].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)); },
    comodinUsado() { return Object.values(this.predictions).some(p => p.comodin); },
    comodinMatchId() {
      const entry = Object.entries(this.predictions).find(([, p]) => p.comodin);
      return entry ? entry[0] : null;
    },
    comodinMatchName() {
      const m = this.allMatches.find(m => m.id === this.comodinMatchId);
      return m ? `${m.home_team} vs ${m.away_team}` : '';
    },
    actualChampion() { return this.settings.actual_champion || null; },
    championBonus() { return 5; },
    whatsappText() {
      const saved = Object.entries(this.predictions)
        .filter(([, p]) => p.id)
        .map(([matchId, p]) => {
          const m = this.allMatches.find(x => x.id === matchId);
          if (!m) return '';
          const comodin = p.comodin ? ' ⭐' : '';
          return `• ${m.home_team} ${p.home}-${p.away} ${m.away_team}${comodin}`;
        }).filter(Boolean);
      if (!saved.length) return '';
      const name = this.userName;
      const champion = this.championPick?.champion ? `\n🏆 Campeón: ${this.championPick.champion}` : '';
      return `🏆 *Mundial 2026 - Pronósticos de ${name}*\n${saved.join('\n')}${champion}`;
    },
    whatsappLink() {
      if (!this.whatsappText) return '';
      const num = this.settings.whatsapp_group || '';
      return `https://wa.me/${num}?text=${encodeURIComponent(this.whatsappText)}`;
    },
    championDeadline() {
      if (!this.allMatches.length) return null;
      const future = this.allMatches
        .map(m => ({ m, dt: parseDateTime(m.date, m.time) }))
        .filter(x => x.dt && x.dt > new Date())
        .sort((a, b) => a.dt - b.dt);
      const target = future.find(x => x.m.round && x.m.round !== 'group') || future[0];
      if (!target) return null;
      const d = new Date(target.dt.getTime() - 60000);
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    },
  },
  methods: {
    _groupMatches(matches) {
      const groups = {};
      for (const m of matches) {
        if (!groups[m.date]) groups[m.date] = { date: m.date, matches: [] };
        groups[m.date].matches.push(m);
      }
      return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
    },
    async loginGoogle() {
      this.authLoading = true; this.authError = '';
      try {
        const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
        this.user = authData.record;
        await this.loadAllData();
      } catch (e) {
        console.error('Login error:', e);
        this.authError = e.message?.includes('popup') ? 'Bloqueador de popups detectado.' : (e.message || 'Error al conectar');
      }
      this.authLoading = false; this.loading = false;
    },
    logout() { pb.authStore.clear(); this.user = null; this.allMatches = []; this.predictions = {}; this.championPick = { champion: '' }; },
    async loadAllData() {
      await Promise.all([this.loadMatches(), this.loadSettings(), this.loadChampionPick()]);
    },
    async loadMatches() {
      try {
        this.allMatches = await pb.collection('matches').getFullList({ sort: 'date,time' });
        await this.loadMyPredictions();
      } catch (e) { console.error('Error loading matches:', e); this.showAlert('Error al cargar partidos', 'error'); }
    },
    async loadAllMatches() {
      try { this.allMatches = await pb.collection('matches').getFullList({ sort: 'date,time' }); }
      catch (e) { console.error(e); }
    },
    async loadMyPredictions() {
      if (this.allMatches.length === 0) return;
      try {
        const ids = this.allMatches.map(m => m.id);
        const clauses = ids.map(id => `match="${id}"`).join('||');
        const records = await pb.collection('predictions').getFullList({
          filter: `user="${this.user.id}" && (${clauses})`,
        });
        for (const p of records) {
          this.predictions[p.match] = { home: p.home_score, away: p.away_score, id: p.id, comodin: !!p.comodin };
        }
      } catch (e) { if (e.status !== 404) console.error(e); }
    },
    async loadSettings() {
      try {
        const records = await pb.collection('settings').getFullList();
        for (const r of records) this.settings[r.key] = r.value;
      } catch (e) { /* settings collection may not exist yet */ }
    },
    async loadChampionPick() {
      this.championLoading = true;
      try {
        const records = await pb.collection('champion_picks').getFullList({
          filter: `user="${this.user.id}"`,
        });
        this.championPick = records[0] || { champion: '' };
      } catch (e) { if (e.status !== 404) console.error(e); }
      this.championLoading = false;
    },
    predHome(matchId) { return this.predictions[matchId]?.home ?? null; },
    predAway(matchId) { return this.predictions[matchId]?.away ?? null; },
    setPredHome(matchId, val) {
      if (!this.predictions[matchId]) this.predictions[matchId] = { home: null, away: null };
      const n = val === '' || val == null ? null : Math.round(Number(val));
      this.predictions[matchId].home = n != null ? Math.max(0, Math.min(99, n)) : null;
    },
    setPredAway(matchId, val) {
      if (!this.predictions[matchId]) this.predictions[matchId] = { home: null, away: null };
      const n = val === '' || val == null ? null : Math.round(Number(val));
      this.predictions[matchId].away = n != null ? Math.max(0, Math.min(99, n)) : null;
    },
    canVote(match) {
      if (match.status !== 'open') return false;
      if (this.predictions[match.id]?.id) return false;
      return this.matchNotStarted(match);
    },
    matchNotStarted(match) {
      const matchDt = parseDateTime(match.date, match.time);
      if (!matchDt) return false;
      return new Date() < new Date(matchDt.getTime() - 60000);
    },

    getMatchStatus(match) {
      if (match.status === 'finished') return 'finished';
      if (!this.canVote(match) && !this.predictions[match.id]?.id) return 'closed';
      return match.status === 'open' ? 'open' : match.status;
    },
    getMatchStatusLabel(match) {
      if (match.status === 'finished') return 'Finalizado';
      if (this.predictions[match.id]?.id && match.status === 'open') return 'Votado';
      if (!this.canVote(match)) return 'Cerrado';
      return 'Abierto';
    },
    toggleComodin(matchId) {
      const p = this.predictions[matchId] || { home: null, away: null };
      if (p.id) return;
      if (this.comodinUsado && !p.comodin) {
        this.showAlert('Ya usaste tu comodín en otro partido', 'error');
        return;
      }
      this.predictions[matchId] = { ...p, comodin: !p.comodin };
    },
    shareWhatsApp() {
      if (this.whatsappLink) window.open(this.whatsappLink, '_blank');
    },
    getFlag(teamName) {
      const c = this.countries.find(p => p.name === teamName);
      return c ? c.flag : '';
    },
    roundLabel(r) {
      return { group: 'Fase Grupos', round_32: '32vos', round_16: '16vos', quarter: 'Cuartos', semi: 'Semis', final: 'Final' }[r] || r;
    },
    formatDate(dateStr) {
      const d = parseDateTime(dateStr, '12:00');
      return d ? d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : dateStr;
    },
    calcPts(pred, match) { return calcPoints(pred, match); },
    predDetail(matchId) {
      const pred = this.predictions[matchId];
      const match = this.allMatches.find(m => m.id === matchId);
      if (!pred?.id || !match || match.status !== 'finished') return null;
      const pts = calcPoints(pred, match);
      let type = '';
      if (pts === null || pts === 0) type = 'wrong';
      else if (pts >= 3) type = 'exact';
      else type = 'winner';
      return { pts, type, comodin: !!pred.comodin, basePts: pred.comodin ? pts / 2 : pts };
    },
    predPoints(matchId) {
      const pred = this.predictions[matchId];
      if (!pred?.id) return null;
      const match = this.allMatches.find(m => m.id === matchId);
      if (!match) return null;
      return calcPoints(pred, match);
    },
    async submitPredictions() {
      const toSubmit = Object.values(this.predictions).filter(p => p.home !== null && p.away !== null && !p.id);
      if (!toSubmit.length) return;
      if (!confirm(`¿Guardar ${toSubmit.length} pronóstico(s)? No podrás editarlos después.`)) return;
      this.saving = true;
      let count = 0;
      try {
        for (const [matchId, pred] of Object.entries(this.predictions)) {
          if (pred.home === null || pred.away === null || pred.id) continue;
          const match = this.allMatches.find(m => m.id === matchId);
          if (!match || !this.canVote(match)) continue;
          const result = await pb.collection('predictions').create({
            user: this.user.id, match: matchId, home_score: pred.home, away_score: pred.away, comodin: !!pred.comodin,
          });
          pred.id = result.id;
          count++;
        }
        this.showAlert(`${count} pronóstico(s) guardado(s)`, 'success');
      } catch (e) { this.showAlert(e.message || 'Error al guardar', 'error'); }
      this.saving = false;
    },
    async saveChampion() {
      if (!this.championPick || !this.championPick.champion) return;
      this.championLoading = true;
      try {
        const r = await pb.collection('champion_picks').create({
          user: this.user.id, champion: this.championPick.champion,
        });
        this.championPick = { ...this.championPick, id: r.id };
        this.showAlert('Campeón guardado', 'success');
      } catch (e) { this.showAlert(e.message || 'Error', 'error'); }
      this.championLoading = false;
    },
    canEditChampion() {
      if (this.championPick?.id) return false;
      if (!this.allMatches.length) return true;
      const now = new Date();
      const future = m => {
        const dt = parseDateTime(m.date, m.time);
        return dt && dt > now;
      };
      const upcoming = this.allMatches.filter(future).sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time));
      if (!upcoming.length) return false;
      const firstNonGroup = upcoming.find(m => m.round && m.round !== 'group');
      const target = firstNonGroup || upcoming[0];
      const dt = parseDateTime(target.date, target.time);
      return dt ? now < new Date(dt.getTime() - 60000) : true;
    },
    async loadRankings() {
      this.rankingsLoading = true;
      try {
        const finishedMatches = this.allMatches.filter(m => m.status === 'finished' && m.home_score != null && m.away_score != null);
        const finishedIds = finishedMatches.map(m => m.id);
        if (finishedIds.length === 0) { this.rankingsData = []; this.rankingsLoading = false; return; }

        const clauses = finishedIds.map(id => `match="${id}"`).join('||');
        const records = await pb.collection('predictions').getFullList({
          filter: `(${clauses})`, expand: 'user',
        });

        // Champion picks for bonus
        let champPicks = [];
        try { champPicks = await pb.collection('champion_picks').getFullList({ expand: 'user' }); }
        catch (_) { }

        const pointsMap = {};
        const userMap = {};
        for (const p of records) {
          const uid = p.user;
          const match = finishedMatches.find(m => m.id === p.match);
          if (!match) continue;
          const pts = calcPoints({ home_score: p.home_score, away_score: p.away_score, comodin: p.comodin }, match);
          if (pts === null) continue;
          if (!pointsMap[uid]) pointsMap[uid] = 0;
          pointsMap[uid] += pts;
          if (!userMap[uid]) userMap[uid] = p.expand?.user?.email?.split('@')[0] || uid;
        }

        // Champion bonus
        for (const cp of champPicks) {
          const uid = cp.user;
          if (this.actualChampion && cp.champion?.toLowerCase() === this.actualChampion.toLowerCase()) {
            if (!pointsMap[uid]) pointsMap[uid] = 0;
            pointsMap[uid] += this.championBonus;
          }
          if (!userMap[uid]) userMap[uid] = cp.expand?.user?.email?.split('@')[0] || uid;
        }

        this.rankingsData = Object.entries(pointsMap)
          .map(([id, pts]) => ({ id, name: userMap[id] || id, points: pts }))
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      } catch (e) { console.error(e); this.showAlert('Error al cargar posiciones', 'error'); }
      this.rankingsLoading = false;
    },
    // Admin
    async addMatch() {
      const data = { ...this.matchForm, status: 'open' };
      if (!data.round) delete data.round;
      if (!data.date || !data.time || !data.home_team || !data.away_team) {
        this.showAlert('Completa todos los campos', 'error'); return;
      }
      try {
        if (this.editingMatch) {
          await pb.collection('matches').update(this.editingMatch.id, data);
          this.showAlert('Partido actualizado', 'success'); this.cancelEdit();
        } else {
          await pb.collection('matches').create(data);
          this.showAlert('Partido agregado', 'success');
          this.matchForm = { date: todayStr(), time: '', home_team: '', away_team: '', round: '' };
        }
        await this.loadAllMatches();
      } catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },
    editMatch(match) {
      this.editingMatch = match;
      this.matchForm = { date: match.date, time: match.time?.slice(0, 5), home_team: match.home_team, away_team: match.away_team, round: match.round || '' };
    },
    cancelEdit() { this.editingMatch = null; this.matchForm = { date: todayStr(), time: '', home_team: '', away_team: '', round: '' }; },
    async deleteMatch(id) {
      if (!confirm('¿Eliminar este partido?')) return;
      try { await pb.collection('matches').delete(id); this.showAlert('Eliminado', 'success'); await this.loadAllMatches(); }
      catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },
    async toggleMatchStatus(match) {
      const newStatus = match.status === 'open' ? 'closed' : match.status === 'closed' ? 'finished' : 'open';
      try { await pb.collection('matches').update(match.id, { status: newStatus }); await this.loadAllMatches(); }
      catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },
    async saveActualScore(match) {
      try {
        await pb.collection('matches').update(match.id, { home_score: match.home_score, away_score: match.away_score, status: 'finished' });
        this.showAlert('Resultado guardado', 'success');
        await this.loadAllMatches();
      } catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },
    async saveSetting(key) {
      if (!key) return;
      try {
        const records = await pb.collection('settings').getFullList({ filter: `key="${key}"` });
        if (records.length > 0) {
          await pb.collection('settings').update(records[0].id, { value: this.settings[key] || '' });
        } else {
          await pb.collection('settings').create({ key, value: this.settings[key] || '' });
        }
        const label = { actual_champion: 'Campeón real', whatsapp_group: 'WhatsApp', whatsapp_group_name: 'WhatsApp' }[key] || key;
        this.showAlert(`${label} guardado`, 'success');
      } catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },
    async toggleExport(match) {
      if (this.selectedExport === match.id) { this.selectedExport = null; return; }
      this.selectedExport = match.id; await this.loadPredictions(match);
    },
    async loadPredictions(match) {
      try {
        this.matchPredictions = await pb.collection('predictions').getFullList({
          filter: `match="${match.id}"`, expand: 'user',
        });
      } catch (e) { this.matchPredictions = []; }
    },
    async exportMatchCSV(match) {
      try {
        const records = await pb.collection('predictions').getFullList({
          filter: `match="${match.id}"`, expand: 'user',
        });
        const header = ['Participante', `${match.home_team}_pred`, `${match.away_team}_pred`,
          `${match.home_team}_real`, `${match.away_team}_real`, 'Comodín', 'Puntos'].join(',');
        const rows = records.map(p => {
          const name = p.expand?.user?.email?.split('@')[0] || '?';
          const pts = calcPoints(p, match);
          const rHome = match.status === 'finished' && match.home_score != null ? match.home_score : '';
          const rAway = match.status === 'finished' && match.away_score != null ? match.away_score : '';
          return [name, p.home_score, p.away_score, rHome, rAway, p.comodin ? 'Sí' : 'No', pts !== null ? pts : ''].join(',');
        });
        if (!rows.length) { this.showAlert('Sin pronósticos para este partido', 'error'); return; }
        const safe = `${match.home_team.replace(/\s+/g,'_')}_vs_${match.away_team.replace(/\s+/g,'_')}`;
        this.downloadCSV(`pronosticos_${safe}.csv`, [header, ...rows].join('\n'));
        this.showAlert('CSV descargado', 'success');
      } catch (e) { this.showAlert(e.message || 'Error', 'error'); }
    },

    async exportFullCSV() {
      try {
        const matches = [...this.allMatches].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        if (!matches.length) { this.showAlert('No hay partidos', 'error'); return; }
        const matchIds = matches.map(m => m.id);
        const clauses = matchIds.map(id => `match="${id}"`).join('||');
        const records = await pb.collection('predictions').getFullList({
          filter: `(${clauses})`, expand: 'user',
        });
        let champPicks = [];
        try { champPicks = await pb.collection('champion_picks').getFullList({ expand: 'user' }); }
        catch (_) { }
        const champMap = {};
        for (const cp of champPicks) champMap[cp.user] = { champion: cp.champion, name: cp.expand?.user?.email?.split('@')[0] || '?' };

        // Index predictions by user
        const userData = {};
        for (const r of records) {
          const uid = r.user;
          if (!userData[uid]) {
            userData[uid] = {
              name: r.expand?.user?.email?.split('@')[0] || uid,
              predictions: {}, champion: champMap[uid]?.champion || '',
            };
          }
          userData[uid].predictions[r.match] = r;
        }
        for (const [uid, cp] of Object.entries(champMap)) {
          if (!userData[uid]) userData[uid] = { name: cp.name, predictions: {}, champion: cp.champion || '' };
        }

        // Wide format: each team in its own pred/real column per match
        const cols = ['Participante', 'Campeón', 'Comodín'];
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          const n = i + 1;
          cols.push(`M${n}_${m.home_team}_L`);
          cols.push(`M${n}_${m.away_team}_V`);
          cols.push(`M${n}_${m.home_team}_R`);
          cols.push(`M${n}_${m.away_team}_R`);
        }
        const rows = [cols.join(',')];
        for (const [uid, u] of Object.entries(userData)) {
          const row = [u.name, u.champion, u.predictions && Object.values(u.predictions).some(p => p.comodin) ? 'Sí' : 'No'];
          for (const m of matches) {
            const p = u.predictions[m.id];
            row.push(p != null ? p.home_score : '');
            row.push(p != null ? p.away_score : '');
            row.push(m.status === 'finished' && m.home_score != null ? m.home_score : '');
            row.push(m.status === 'finished' && m.away_score != null ? m.away_score : '');
          }
          rows.push(row.join(','));
        }
        this.downloadCSV('mundial2026_completo.csv', rows.join('\n'));
        this.showAlert('CSV descargado', 'success');
      } catch (e) { this.showAlert(e.message || 'Error al exportar', 'error'); }
    },
    downloadCSV(filename, text) {
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    },
    showAlert(msg, type) { this.alert = msg; this.alertType = type || 'info'; setTimeout(() => { this.alert = ''; }, 4000); },
  },
  async mounted() {
    if (pb.authStore.isValid) {
      try {
        const { record } = await pb.collection('users').authRefresh();
        this.user = record;
        await this.loadAllData();
      } catch (_) { pb.authStore.clear(); }
    }
    this.loading = false;
  },
}).mount('#app');
