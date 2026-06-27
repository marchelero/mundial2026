const APP_TZ = 'America/La_Paz';

function partsInTZ(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });
    const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
    return {
        y: p.year, m: p.month, d: p.day,
        hh: p.hour === '24' ? '00' : p.hour,
        mm: p.minute, ss: p.second
    };
}

export function todayStr() {
    const p = partsInTZ();
    return p.y + '-' + p.m + '-' + p.d;
}

export function addDaysStr(days) {
    const p = partsInTZ();
    const base = new Date(Date.UTC(+p.y, +p.m - 1, +p.d, 12, 0, 0));
    base.setUTCDate(base.getUTCDate() + days);
    const yy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(base.getUTCDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
}

export function nowStr() {
    const p = partsInTZ();
    return p.y + '-' + p.m + '-' + p.d + ' ' + p.hh + ':' + p.mm;
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
        round_16: '16avos',
        round_8: '8vos',
        quarter: '4tos',
        semi: 'Semifinal',
        final: 'Final'
    }[r] || r;
}

export function groupLabel(match) {
    if (!match) return '';
    if (match.group_name) {
        return match.round === 'group' ? 'Grupo ' + match.group_name : match.group_name;
    }
    return '';
}

export function flagUrl(emojiFlag) {
    if (!emojiFlag || emojiFlag.length < 2) return '';
    try {
        const chars = [...emojiFlag];
        const first = chars[0].codePointAt(0);
        if (first === 0x1F3F4) {
            const tags = chars.slice(1, -1).map(c => {
                const code = c.codePointAt(0);
                if (code >= 0xE0061 && code <= 0xE007A) return String.fromCharCode(code - 0xE0061 + 97);
                return null;
            }).filter(Boolean).join('');
            if (tags.length >= 4) return 'https://flagcdn.com/24x18/' + tags.slice(0, 2) + '-' + tags.slice(2) + '.png';
            return '';
        }
        const codes = chars.map(c => {
            const code = c.codePointAt(0);
            if (!code || code < 127462) return null;
            return String.fromCharCode(code - 127397).toLowerCase();
        }).filter(Boolean).join('');
        if (codes.length !== 2) return '';
        return 'https://flagcdn.com/24x18/' + codes + '.png';
    } catch (_) { return ''; }
}
