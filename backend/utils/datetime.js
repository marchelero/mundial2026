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

function nowStr() {
  const p = partsInTZ();
  return p.y + '-' + p.m + '-' + p.d + ' ' + p.hh + ':' + p.mm;
}

function todayStr() {
  const p = partsInTZ();
  return p.y + '-' + p.m + '-' + p.d;
}

module.exports = { APP_TZ, partsInTZ, nowStr, todayStr };
