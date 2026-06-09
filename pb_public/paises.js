// Todos los 48 países clasificados al Mundial 2026
// Fuente: FIFA.com - https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/world-cup-2026-who-has-qualified
var PAISES_MUNDIAL2026 = [
  // Co-anfitriones
  { name: 'Canadá', flag: '🇨🇦', confederation: 'CONCACAF' },
  { name: 'México', flag: '🇲🇽', confederation: 'CONCACAF' },
  { name: 'Estados Unidos', flag: '🇺🇸', confederation: 'CONCACAF' },

  // AFC (Asia) - 9
  { name: 'Australia', flag: '🇦🇺', confederation: 'AFC' },
  { name: 'Irak', flag: '🇮🇶', confederation: 'AFC' },
  { name: 'Irán', flag: '🇮🇷', confederation: 'AFC' },
  { name: 'Japón', flag: '🇯🇵', confederation: 'AFC' },
  { name: 'Jordania', flag: '🇯🇴', confederation: 'AFC' },
  { name: 'Corea del Sur', flag: '🇰🇷', confederation: 'AFC' },
  { name: 'Catar', flag: '🇶🇦', confederation: 'AFC' },
  { name: 'Arabia Saudita', flag: '🇸🇦', confederation: 'AFC' },
  { name: 'Uzbekistán', flag: '🇺🇿', confederation: 'AFC' },

  // CAF (África) - 10
  { name: 'Argelia', flag: '🇩🇿', confederation: 'CAF' },
  { name: 'Cabo Verde', flag: '🇨🇻', confederation: 'CAF' },
  { name: 'Congo DR', flag: '🇨🇩', confederation: 'CAF' },
  { name: 'Costa de Marfil', flag: '🇨🇮', confederation: 'CAF' },
  { name: 'Egipto', flag: '🇪🇬', confederation: 'CAF' },
  { name: 'Ghana', flag: '🇬🇭', confederation: 'CAF' },
  { name: 'Marruecos', flag: '🇲🇦', confederation: 'CAF' },
  { name: 'Senegal', flag: '🇸🇳', confederation: 'CAF' },
  { name: 'Sudáfrica', flag: '🇿🇦', confederation: 'CAF' },
  { name: 'Túnez', flag: '🇹🇳', confederation: 'CAF' },

  // CONCACAF (Norteamérica, Centroamérica, Caribe) - 3 adicionales
  { name: 'Curazao', flag: '🇨🇼', confederation: 'CONCACAF' },
  { name: 'Haití', flag: '🇭🇹', confederation: 'CONCACAF' },
  { name: 'Panamá', flag: '🇵🇦', confederation: 'CONCACAF' },

  // CONMEBOL (Sudamérica) - 6
  { name: 'Argentina', flag: '🇦🇷', confederation: 'CONMEBOL' },
  { name: 'Brasil', flag: '🇧🇷', confederation: 'CONMEBOL' },
  { name: 'Colombia', flag: '🇨🇴', confederation: 'CONMEBOL' },
  { name: 'Ecuador', flag: '🇪🇨', confederation: 'CONMEBOL' },
  { name: 'Paraguay', flag: '🇵🇾', confederation: 'CONMEBOL' },
  { name: 'Uruguay', flag: '🇺🇾', confederation: 'CONMEBOL' },

  // OFC (Oceanía) - 1
  { name: 'Nueva Zelanda', flag: '🇳🇿', confederation: 'OFC' },

  // UEFA (Europa) - 16
  { name: 'Alemania', flag: '🇩🇪', confederation: 'UEFA' },
  { name: 'Austria', flag: '🇦🇹', confederation: 'UEFA' },
  { name: 'Bélgica', flag: '🇧🇪', confederation: 'UEFA' },
  { name: 'Bosnia y Herzegovina', flag: '🇧🇦', confederation: 'UEFA' },
  { name: 'Croacia', flag: '🇭🇷', confederation: 'UEFA' },
  { name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA' },
  { name: 'España', flag: '🇪🇸', confederation: 'UEFA' },
  { name: 'Francia', flag: '🇫🇷', confederation: 'UEFA' },
  { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
  { name: 'Noruega', flag: '🇳🇴', confederation: 'UEFA' },
  { name: 'Países Bajos', flag: '🇳🇱', confederation: 'UEFA' },
  { name: 'Portugal', flag: '🇵🇹', confederation: 'UEFA' },
  { name: 'República Checa', flag: '🇨🇿', confederation: 'UEFA' },
  { name: 'Suecia', flag: '🇸🇪', confederation: 'UEFA' },
  { name: 'Suiza', flag: '🇨🇭', confederation: 'UEFA' },
  { name: 'Turquía', flag: '🇹🇷', confederation: 'UEFA' },
];

// Helper: array plano de nombres para selects
var PAISES_NOMBRES = PAISES_MUNDIAL2026.map(p => p.name);
