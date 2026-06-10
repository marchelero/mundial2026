import { pb } from './pb.js';

export async function loadMatches() {
    return await pb.collection('matches').getFullList({ sort: 'date,time' });
}

export async function loadPredictions(userId) {
    return await pb.collection('predictions').getFullList({
        filter: `user="${userId}"`,
    });
}

export async function loadSettings() {
    const records = await pb.collection('settings').getFullList();
    const settings = {};
    for (const r of records) settings[r.key] = r.value;
    return settings;
}

export async function loadChampionPick(userId) {
    const records = await pb.collection('champion_picks').getFullList({
        filter: `user="${userId}"`,
    });
    return records[0] || { champion: '' };
}

export async function savePrediction(prediction) {
    if (prediction.id) {
        return await pb.collection('predictions').update(prediction.id, prediction);
    } else {
        return await pb.collection('predictions').create(prediction);
    }
}

export async function saveChampionPick(userId, champion) {
    return await pb.collection('champion_picks').create({
        user: userId,
        champion: champion,
    });
}

export async function saveSetting(key, value) {
    const records = await pb.collection('settings').getFullList({ filter: `key="${key}"` });
    if (records.length > 0) {
        return await pb.collection('settings').update(records[0].id, { value });
    } else {
        return await pb.collection('settings').create({ key, value });
    }
}

export async function loadAllRankings(finishedMatches, actualChampion, championBonus) {
    const finishedIds = finishedMatches.map(m => m.id);
    if (finishedIds.length === 0) return [];

    const clauses = finishedIds.map(id => `match="${id}"`).join('||');
    const records = await pb.collection('predictions').getFullList({
        filter: `(${clauses})`,
        expand: 'user',
    });

    // Champion picks for bonus
    let champPicks = [];
    try { champPicks = await pb.collection('champion_picks').getFullList({ expand: 'user' }); }
    catch (_) { }

    const pointsMap = {};
    const userMap = {};

    // Simple point calculator (imported or redefined if needed here, but better to pass it in or use a shared one)
    // For simplicity in this service, we'll assume the caller provides logic or we use the shared one.
    // Actually, let's keep the ranking logic slightly more decoupled.

    return { records, champPicks };
}
