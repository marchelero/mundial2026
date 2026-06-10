export function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function parseDateTime(dateStr, timeStr) {
    let d = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (d) return new Date(d[1] + '-' + d[2] + '-' + d[3] + 'T' + (timeStr || '12:00'));
    d = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (d) return new Date(d[3] + '-' + d[2] + '-' + d[1] + 'T' + (timeStr || '12:00'));
    return null;
}

export function calcPoints(pred, match) {
    if (match.status !== 'finished' || match.home_score == null || match.away_score == null) return null;
    if (pred.home_score == null || pred.away_score == null) return null;
    let pts = 0;
    if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
        pts = 3;
    } else {
        const pd = pred.home_score - pred.away_score;
        const rd = match.home_score - match.away_score;
        if (pd === rd && rd === 0) pts = 1;
        else if ((pd > 0 && rd > 0) || (pd < 0 && rd < 0)) pts = 1;
    }
    return pred.comodin ? pts * 2 : pts;
}

export function formatDate(dateStr) {
    const d = parseDateTime(dateStr, '12:00');
    return d ? d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : dateStr;
}

export function roundLabel(r) {
    return {
        group: 'Fase Grupos',
        round_32: '32vos',
        round_16: '16vos',
        quarter: 'Cuartos',
        semi: 'Semis',
        final: 'Final'
    }[r] || r;
}
