import { api } from './api.js';

export async function loadMatches() {
  return await api.get('/matches');
}

export async function loadPredictions(userId) {
  return await api.get(`/predictions?user=${encodeURIComponent(userId)}`);
}

export async function loadMatchPredictions(matchId) {
  return await api.get(`/predictions/match/${encodeURIComponent(matchId)}`);
}

export async function loadSettings() {
  const records = await api.get('/settings');
  const settings = {};
  for (const r of records) settings[r.key] = r.value;
  return settings;
}

export async function loadChampionPick() {
  const pick = await api.get('/champion-picks');
  return pick || { champion: '' };
}

export async function savePrediction(prediction) {
  return await api.post('/predictions', {
    match: prediction.match,
    home_score: prediction.home_score,
    away_score: prediction.away_score,
    comodin: !!prediction.comodin,
  });
}

export async function saveChampionPick(champion) {
  return await api.post('/champion-picks', { champion });
}

export async function saveSetting(key, value) {
  return await api.post('/settings', { key, value });
}

export async function savePredictionsBatch(predictions) {
  return await api.post('/predictions/batch', { predictions });
}
