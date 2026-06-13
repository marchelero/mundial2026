const COUNTRIES = [
  { name: 'Canadá', flag: '🇨🇦' },
  { name: 'México', flag: '🇲🇽' },
  { name: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Irak', flag: '🇮🇶' },
  { name: 'Irán', flag: '🇮🇷' },
  { name: 'Japón', flag: '🇯🇵' },
  { name: 'Jordania', flag: '🇯🇴' },
  { name: 'Corea del Sur', flag: '🇰🇷' },
  { name: 'Catar', flag: '🇶🇦' },
  { name: 'Arabia Saudita', flag: '🇸🇦' },
  { name: 'Uzbekistán', flag: '🇺🇿' },
  { name: 'Argelia', flag: '🇩🇿' },
  { name: 'Cabo Verde', flag: '🇨🇻' },
  { name: 'Congo DR', flag: '🇨🇩' },
  { name: 'Costa de Marfil', flag: '🇨🇮' },
  { name: 'Egipto', flag: '🇪🇬' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Marruecos', flag: '🇲🇦' },
  { name: 'Senegal', flag: '🇸🇳' },
  { name: 'Sudáfrica', flag: '🇿🇦' },
  { name: 'Túnez', flag: '🇹🇳' },
  { name: 'Curazao', flag: '🇨🇼' },
  { name: 'Haití', flag: '🇭🇹' },
  { name: 'Panamá', flag: '🇵🇦' },
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Brasil', flag: '🇧🇷' },
  { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'Uruguay', flag: '🇺🇾' },
  { name: 'Nueva Zelanda', flag: '🇳🇿' },
  { name: 'Alemania', flag: '🇩🇪' },
  { name: 'Austria', flag: '🇦🇹' },
  { name: 'Bélgica', flag: '🇧🇪' },
  { name: 'Bosnia y Herzegovina', flag: '🇧🇦' },
  { name: 'Croacia', flag: '🇭🇷' },
  { name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'España', flag: '🇪🇸' },
  { name: 'Francia', flag: '🇫🇷' },
  { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Italia', flag: '🇮🇹' },
  { name: 'Noruega', flag: '🇳🇴' },
  { name: 'Países Bajos', flag: '🇳🇱' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'República Checa', flag: '🇨🇿' },
  { name: 'Suecia', flag: '🇸🇪' },
  { name: 'Suiza', flag: '🇨🇭' },
  { name: 'Turquía', flag: '🇹🇷' },
];

function flagEmoji(teamName) {
  const c = COUNTRIES.find(x => x.name.toLowerCase() === teamName.toLowerCase());
  return c ? c.flag : '🏳️';
}

function flagUrl(emojiFlag) {
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

function flagCode(emojiFlag) {
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
      if (tags.length >= 4) return tags.slice(0, 2).toUpperCase();
      return '';
    }
    const codes = chars.map(c => {
      const code = c.codePointAt(0);
      if (!code || code < 127462) return null;
      return String.fromCharCode(code - 127397).toUpperCase();
    }).filter(Boolean).join('');
    return codes;
  } catch (_) { return ''; }
}

module.exports = { COUNTRIES, flagEmoji, flagUrl, flagCode };
