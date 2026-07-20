# MULTI_TOURNAMENT — Generalizar para cualquier campeonato

> Análisis técnico: cómo pasar de "polla del Mundial 2026" a una plataforma genérica que sirva para Mundial, Champions League, Copa América, NBA Playoffs, NFL Season, Premier League, o cualquier torneo. Incluye schema, tipos de torneo, esfuerzo, naming y decisión pragmática.

**Audiencia:** vos (Marcelo) leyendo dentro de 2 años antes de empezar el próximo proyecto, o cualquier developer que tome el código.

**Premisa:** el Mundial 2026 es un caso particular. El patrón (predictions, scoring, ranking, bracket) aplica a cualquier torneo deportivo. La pregunta es si vale la pena generalizarlo desde el inicio o esperar.

---

## 1. Por qué generalizar

### 1.1 Razón de negocio

El Mundial es cada 4 años. El resto del tiempo la app duerme. Si la plataforma soporta otros torneos:

- **Champions League (anual, sept-junio)**: engagement permanente.
- **Copa América / Euro (cada 2-4 años)**: picos adicionales.
- **NBA Playoffs (abril-junio)**: mercado US/canadiense.
- **Premier League / La Liga (agosto-mayo)**: weekly engagement.
- **NFL Season (sept-febrero)**: mercado US masivo.

Una plataforma multi-deporte = engagement permanente vs un pico cada 4 años.

### 1.2 Razón técnica

El v1 está hardcodeado a "Mundial":

- `backend/lib/bracket-init.js` tiene `R32_FIXTURE`, `R16_FIXTURE` específicos del Mundial 48-equipos.
- `data/matches.json` tiene 12 grupos A-L hardcodeados.
- `backend/services/whatsapp.js` y `push.js` mencionan "Mundial 2026" en mensajes.
- `package.json` dice `mundial2026-polla`.

Si querés agregar Champions League, hay que reescribir gran parte. El costo de reescribir ahora vs diseñar genérico desde el inicio es alto. Pero el costo de diseñar genérico desde el inicio **siendo que solo vas a usar 1 torneo al inicio** también es alto.

### 1.3 Razón de audiencia

Una polla genérica sirve para grupos de amigos más amplios: no solo "amigos del Mundial", sino "amigos del fútbol", "la oficina sigue la Champions", "familia sigue la NBA". Más mercado potencial, más viralidad.

### 1.4 Razón de reuso

El código de scoring engine, ranking, bracket propagation, push notifications, auth, admin: todo eso es 100% genérico ya. Solo la capa de "qué es un torneo" está hardcodeada. Esa es la única zona a refactorizar.

---

## 2. Qué cambia y qué se mantiene

### 2.1 Lo que se mantiene tal cual (80% del código)

- **Auth** (Google OAuth + JWT): 100% genérico, no toca.
- **Users + profiles**: genérico.
- **Push / WhatsApp delivery**: solo cambia el mensaje (template), no la infraestructura.
- **Scoring engine**: el algoritmo es genérico (exact=3, partial=1, wrong=0). Solo los valores son configurables.
- **Ranking / podium / race chart**: lógica genérica, solo cambia la fuente de datos.
- **Admin UI genérico**: CRUD, manual scores, recompute, backup, restore: todo genérico.
- **PWA / service worker**: 100% genérico.

### 2.2 Lo que se generaliza (15% del código)

- **Schema de competición**: en vez de `matches` y `bracket_matches` hardcodeados, generalizar a `tournaments`, `seasons`, `stages`, `teams`, `matches`, `bracket_slots`.
- **Match data import**: en vez de `data/matches.json` estático, un endpoint admin para cargar matches de cualquier torneo (o import desde API externa).
- **Fixture generator**: en vez de `R32_FIXTURE` hardcodeado, un generador genérico que produce bracket a partir de "X grupos, Y clasificados".
- **Prediction types**: en vez de solo "match result", soportar más tipos (primer gol, over/under, etc) por torneo.
- **Messages / templates**: parametrizar el nombre del torneo y de los equipos en push/WhatsApp/email.
- **Branding**: logo, colores, hero image por torneo.

### 2.3 Lo que queda específico por deporte (5%)

- **Tipos de predicción únicos** (ej: NBA tiene "total de puntos del jugador", NFL tiene "spread de puntos"). Configurable pero requiere config específica.
- **Reglas de scoring especiales** (ej: Champions League da 2 puntos por victoria en grupos, 0 por empate en algunos fantasy). Configurable.
- **Bracket peculiarities** (NBA es best-of-7, Champions es single match). Configurable.

El 95% del código es genérico. El 5% es config.

---

## 3. Tipos de torneo a soportar

La idea es que el schema soporte todos los formatos comunes. La UI no tiene que soportar todos desde el día 1: arranca con 1-2 y se expande.

### 3.1 Fútbol con grupos + eliminación (Mundial, Euro, Copa América)

**Estructura:** N grupos de K equipos → top X clasifican → eliminación directa (R32, R16, QF, SF, Final).

**Ejemplos:** Mundial 2026 (12 grupos × 4, top 2 → R32), Euro 2024 (6 grupos × 4, top 2 + 4 mejores 3ros → R16), Copa América (4 grupos × 4, top 2 → QF).

**Schema fits:** sí, directamente.

**UI elements:** group standings, bracket tree, prediction form por partido.

### 3.2 Fútbol eliminación directa pura (FA Cup, Copa del Rey fases finales, Champions playoffs)

**Estructura:** bracket puro sin grupos. Single elimination o double elimination.

**Ejemplos:** Champions League fase eliminatoria desde R16, FA Cup desde R16.

**Schema fits:** sí, con `stages` sin `team_groups`.

**UI elements:** bracket tree únicamente.

### 3.3 Fútbol round-robin (Premier League, La Liga, Serie A, Ligue 1)

**Estructura:** N equipos, todos contra todos, K fechas. No hay eliminación.

**Ejemplos:** Premier League (20 equipos, 38 fechas), La Liga (20 equipos, 38 fechas), Champions League fase liga (36 equipos, 8 fechas, formato nuevo 2024-25).

**Schema fits:** sí, con un solo `team_group` conteniendo todos los equipos, sin bracket.

**UI elements:** tabla de posiciones, calendario de fechas, prediction por partido.

**Complejidad adicional:** 38 fechas × 10 partidos = 380 partidos. Volume alto, requiere paginación y filters.

### 3.4 Fútbol con fase liga + eliminación (Champions League 2024+)

**Estructura:** nueva Champions: 36 equipos, 8 fechas liga (cada equipo juega 8 distintos), top 8 → R16 directo, 9-24 → playoff previo a R16, resto eliminado.

**Schema fits:** sí, con stages múltiples encadenadas.

**UI elements:** tabla de la fase liga + bracket de eliminación. Dos vistas.

### 3.5 NFL Season (regular season + playoffs)

**Estructura:** 32 equipos, 2 conferences (AFC/NFC), 4 divisions por conference, 17 fechas regular season, 14 equipos clasifican a playoffs, 4 rondas + Super Bowl.

**Schema fits:** sí, con jerarquía conference > division > team, stages regular season + playoffs.

**UI elements:** standings por conference, bracket de playoffs, prediction por partido (incluye spreads).

**Complejidad adicional:** spreads y over/under son predictions comunes, agregar `prediction_type` específico.

### 3.6 NBA Season (regular season + playoffs)

**Estructura:** 30 equipos, 2 conferences (East/West), 3 divisions por conference, 82 fechas regular season, 16 equipos a playoffs (8 por conference), best-of-7 series.

**Schema fits:** sí, igual que NFL conceptualmente. Diferencia: 82 fechas × muchos partidos = ~1200 partidos en regular season.

**UI elements:** standings, bracket de playoffs por conference, prediction por partido o por series.

**Complejidad adicional:** volume alto. Requiere predicciones por juego o por serie (best-of-7).

### 3.7 NHL / MLB / Soccer leagues (round-robin largo)

Similar a Premier League: round-robin largo con playoffs opcionales. Schema sirve.

### 3.8 Otros formatos

- **Torneos con round-robin + fase final**: Champions League viejo, Europa League, Conference League.
- **Torneos con fase de clasificación**: Eurocopa (10 grupos de clasificación, top clasifican a fase final).
- **Torneos con todos contra todos + semifinal + final** (Copa América viejo formato): similar a round-robin con playoff corto.
- **Ligas fantasy** (NFL Fantasy, Premier League Fantasy): modelo diferente (roster de jugadores, no teams). **No entra en este scope.**

---

## 4. Schema propuesto (genérico)

El schema v1 tiene 8 tablas: `users`, `matches`, `predictions`, `champion_picks`, `settings`, `push_subscriptions`, `match_reminders`, `bracket_matches`.

El schema v2 genérico tiene ~12 tablas. Algunas son equivalentes, otras nuevas.

### 4.1 Entidades de primer nivel

```sql
-- Un "producto" o marca. Puede ser "Polla" o "Pool" o "BracketHub".
-- Una sola fila en práctica, pero existe para multi-producto futuro.
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,        -- 'main', 'white-label-1'
  name TEXT NOT NULL,               -- 'Polla', 'White Label 1'
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Un "deporte" o "disciplina". Opcional, pero ayuda con iconografía y filtros.
CREATE TABLE sports (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'football', 'basketball', 'american_football', 'baseball'
  name TEXT NOT NULL,
  icon_url TEXT
);

-- Un "tipo de torneo": cómo se estructura.
-- Esto es meta-config, no se persiste por torneo individual.
-- Opcional, alternativa: hardcodear en código.
CREATE TABLE tournament_formats (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'groups_knockout', 'knockout', 'round_robin', 'playoffs', 'league_with_playoffs'
  name TEXT NOT NULL,
  description TEXT
);
```

### 4.2 Torneo y sus ediciones

```sql
-- Un "campeonato" abstracto: "Copa América", "Premier League", "NBA".
-- Puede tener muchas seasons.
CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  sport_id INTEGER REFERENCES sports(id),
  format_id INTEGER REFERENCES tournament_formats(id),
  slug TEXT UNIQUE NOT NULL,        -- 'copa-america', 'premier-league', 'nba'
  name TEXT NOT NULL,               -- 'Copa América', 'Premier League'
  logo_url TEXT,
  primary_color TEXT,               -- hex
  metadata JSONB DEFAULT '{}',      -- { country, founded, ... }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Una "edición" específica: "Mundial 2026", "Premier League 2025-26", "NBA 2025-26".
-- Esto es lo que el usuario realmente sigue.
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  slug TEXT UNIQUE NOT NULL,        -- 'mundial-2026', 'premier-league-2025-26'
  name TEXT NOT NULL,               -- 'Mundial 2026'
  year INTEGER NOT NULL,            -- 2026
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT FALSE,  -- solo una season activa a la vez por tournament
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_season_tournament_year ON seasons (tournament_id, year);
```

### 4.3 Stages (fases del torneo)

```sql
-- Cada season tiene N stages. Ejemplo Mundial 2026:
--   1. Group Stage (12 grupos)
--   2. Round of 32
--   3. Round of 16
--   4. Quarter-finals
--   5. Semi-finals
--   6. Third-place match
--   7. Final
CREATE TABLE stages (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  name TEXT NOT NULL,               -- 'Group Stage', 'Round of 16', 'Regular Season Week 1'
  type TEXT NOT NULL,               -- 'group', 'knockout', 'round_robin', 'playoff_round', 'best_of_series'
  order_index INTEGER NOT NULL,     -- 1, 2, 3, ...
  config JSONB DEFAULT '{}',        -- { num_groups: 12, teams_per_group: 4, advancing: 2, legs: 1|2 }
  starts_at TIMESTAMP,
  ends_at TIMESTAMP
);

CREATE INDEX idx_stages_season_order ON stages (season_id, order_index);
```

### 4.4 Equipos y grupos

```sql
-- Equipos. Genérico: puede ser país, club, selección, franquicia NBA, etc.
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  external_id TEXT,                 -- ID de API externa (opcional)
  name TEXT NOT NULL,               -- 'Brazil', 'Manchester City', 'Los Angeles Lakers'
  short_name TEXT,                  -- 'BRA', 'MCI', 'LAL'
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',      -- { confederation, coach, stadium, ... }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teams_season ON teams (season_id);

-- Grupos dentro de un stage. Ejemplo Mundial 2026: 12 grupos (A-L).
-- Ejemplo Premier League: 1 grupo con 20 equipos.
-- Ejemplo NFL: 8 divisions (4 por conference).
CREATE TABLE team_groups (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER REFERENCES stages(id),
  name TEXT NOT NULL,               -- 'Group A', 'Eastern Conference', 'AFC East'
  short_name TEXT,                  -- 'A', 'East', 'AFCE'
  order_index INTEGER NOT NULL
);

CREATE INDEX idx_team_groups_stage ON team_groups (stage_id, order_index);

-- Membresía equipo-grupo. Many-to-many porque un equipo podría estar en varios grupos
-- (ej: en fase de grupos Y en el grupo "todos" para standings generales).
CREATE TABLE team_group_members (
  team_group_id INTEGER REFERENCES team_groups(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  seed INTEGER,                     -- posición / seed dentro del grupo
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (team_group_id, team_id)
);

CREATE INDEX idx_team_group_members_team ON team_group_members (team_id);
```

### 4.5 Matches (partidos / juegos)

```sql
-- El "partido" genérico. Funciona para fútbol, basketball, football, etc.
-- En basketball/football puede ser "Game 1 of 7" (best-of series).
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  stage_id INTEGER REFERENCES stages(id),
  team_group_id INTEGER REFERENCES team_groups(id),  -- nullable: knockout puro no tiene grupo
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  scheduled_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed' | 'suspended'
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT,
  referee TEXT,
  metadata JSONB DEFAULT '{}',      -- sport-specific: weather, attendance, etc
  external_id TEXT,                 -- para sync con API externa
  -- Para series (NBA best-of-7)
  series_id INTEGER,                -- si es parte de una serie, todas las matches tienen el mismo
  series_game_number INTEGER,       -- 1, 2, 3, 4, 5, 6, 7
  -- Para bracket
  bracket_slot_id INTEGER REFERENCES bracket_slots(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matches_season_stage ON matches (season_id, stage_id);
CREATE INDEX idx_matches_scheduled ON matches (scheduled_at);
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_home_team ON matches (home_team_id);
CREATE INDEX idx_matches_away_team ON matches (away_team_id);
```

### 4.6 Bracket (slots y propagación)

```sql
-- Slots del bracket. Cada match de knockout está en un slot.
-- El slot tiene un "feeds_into" que es el slot del próximo partido.
-- Esto generaliza el bracket-init.js del v1.
CREATE TABLE bracket_slots (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER REFERENCES stages(id),
  match_id INTEGER REFERENCES matches(id),
  position INTEGER NOT NULL,         -- slot dentro del stage (1, 2, 3, ...)
  feeds_into_slot_id INTEGER REFERENCES bracket_slots(id),  -- null si es final
  feed_type TEXT,                   -- 'winner' | 'loser' | '1st_of_group' | '2nd_of_group' | '3rd_of_group' | ...
  source_group_id INTEGER REFERENCES team_groups(id),  -- para "1st of group A"
  source_position INTEGER,          -- 1, 2, 3 para "1st/2nd/3rd of group"
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_bracket_slots_stage ON bracket_slots (stage_id, position);
CREATE INDEX idx_bracket_slots_feeds ON bracket_slots (feeds_into_slot_id);
```

### 4.7 Prediction types (configurable por season)

```sql
-- Tipos de predicción que un torneo admite. Por defecto: 'match_result'.
-- Champions podría agregar 'first_goal', 'over_under', 'both_score'.
-- NBA podría agregar 'total_points', 'spread', 'player_props'.
CREATE TABLE prediction_types (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  code TEXT NOT NULL,               -- 'match_result', 'first_goal', 'over_under', 'total_points'
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}',        -- opciones, min, max
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_prediction_types_season_code ON prediction_types (season_id, code);

-- Scoring rules por tipo de predicción. Configurable por season.
CREATE TABLE scoring_configs (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  prediction_type_id INTEGER REFERENCES prediction_types(id),
  exact_points INTEGER NOT NULL DEFAULT 3,
  partial_points INTEGER NOT NULL DEFAULT 1,
  wrong_points INTEGER NOT NULL DEFAULT 0,
  wildcard_multiplier NUMERIC(3,1) DEFAULT 2.0,  -- ×2 para comodín
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_scoring_configs_season_type ON scoring_configs (season_id, prediction_type_id);
```

### 4.8 Predictions (flexibles)

```sql
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  match_id INTEGER REFERENCES matches(id),
  prediction_type_id INTEGER REFERENCES prediction_types(id),
  payload JSONB NOT NULL,           -- { home: 2, away: 1 } o { pick: 'home' } según tipo
  points INTEGER,                   -- calculado cuando el match termina
  is_wildcard BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,  -- después del deadline
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_predictions_user_match_type ON predictions (user_id, match_id, prediction_type_id);
CREATE INDEX idx_predictions_user ON predictions (user_id);
CREATE INDEX idx_predictions_match ON predictions (match_id);
```

### 4.9 Overall pick (campeón / ganador del torneo)

```sql
-- El "pick" del ganador final del torneo. En NBA sería el campeón,
-- en Premier League sería el campeón de liga, en NFL el Super Bowl winner.
CREATE TABLE overall_picks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  season_id INTEGER REFERENCES seasons(id),
  team_id INTEGER REFERENCES teams(id),
  points INTEGER,                   -- calculado al final del torneo
  awarded_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_overall_picks_user_season ON overall_picks (user_id, season_id);
```

### 4.10 Leagues (multi-tenancy, del ROADMAP)

```sql
CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  join_code TEXT,                   -- código de invitación si privado
  max_members INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE league_members (
  league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (league_id, user_id)
);
```

### 4.11 Settings por season

```sql
-- En vez del v1 `settings` key-value global, ahora es por season.
CREATE TABLE season_settings (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, key)
);
```

### 4.12 Subscriptions / notifications / jobs

```sql
-- Web push subs, ahora asociadas a user (siguen globales, no por season).
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  subscription JSONB NOT NULL,      -- { endpoint, keys: { p256dh, auth } }
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log de reminders enviados (auditoría).
CREATE TABLE match_reminders (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id),
  user_id INTEGER REFERENCES users(id),
  channel TEXT NOT NULL,            -- 'push' | 'whatsapp' | 'email'
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT,                      -- 'sent' | 'failed'
  error TEXT
);
```

### 4.13 Audit log (mencionado en ROADMAP)

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log (actor_id);
CREATE INDEX idx_audit_created ON audit_log (created_at DESC);
```

### 4.14 Diferencias con v1

| v1 | v2 genérico | Razón |
|----|-------------|-------|
| `matches` | `matches` con `season_id` | Multi-torneo |
| `bracket_matches` | `bracket_slots` + relaciones | Generalizar a más formatos |
| `champion_picks` | `overall_picks` con `team_id` | Genérico |
| `settings` (global) | `season_settings` (por season) | Aislar config por torneo |
| hardcode "Mundial" | `tournaments` + `seasons` | Multi-torneo |
| 12 grupos A-L hardcoded | `team_groups` dinámico | Cualquier formato |
| `prediction_type` implícito | `prediction_types` tabla | Configurable |
| Scoring hardcoded (3/1/0) | `scoring_configs` | Configurable por season |

El cambio es **estructural, no funcional**. La UI consume lo mismo, pero ahora parametrizado.

---

## 5. Bracket generator genérico

El v1 tiene `bracket-init.js` con `R32_FIXTURE`, `R16_FIXTURE`, etc hardcoded. Para v2, un generador genérico.

### 5.1 Input

```typescript
interface BracketConfig {
  stage_id: number
  num_teams: number              // 32, 16, 8, 4
  feed_type: 'winner' | 'loser'  // single elim o double elim
  source: 'group_standings' | 'previous_stage' | 'seeded'
  source_config: {
    // Para group_standings: cuántos clasificados por grupo, en qué orden
    advancing_per_group?: number[]
    // Para previous_stage: el stage anterior
    previous_stage_id?: number
    // Para seeded: el orden de seeding
    seed_order?: number[]
  }
  third_place_match?: boolean    // ¿hay partido por el 3er puesto?
  legs?: 1 | 2                   // ¿ida y vuelta? (ej: Champions R16)
}
```

### 5.2 Algoritmo

```typescript
function generateBracket(config: BracketConfig): BracketSlot[] {
  const slots: BracketSlot[] = []
  
  if (config.source === 'group_standings') {
    // Mundial 2026: 12 grupos × 2 = 24 equipos. R32 tiene 32 slots.
    // Top 2 de cada grupo + 8 mejores 3ros = 32.
    const totalSlots = config.num_teams
    const groups = config.source_config.advancing_per_group.length
    
    // Asignar slots. Para mundial: 1A vs 2B, 1C vs 2D, etc.
    // Para Champions: 1º vs 2º, 3º vs 4º, etc.
    // El pairing depende del formato. FIFA tiene un patrón específico.
    // En general, se puede parametrizar.
  } else if (config.source === 'previous_stage') {
    // 16 ganadores de R32 → 8 slots en R16. Pairing 1v16, 2v15, etc.
    const winners = getWinnersFromStage(config.source_config.previous_stage_id)
    for (let i = 0; i < config.num_teams; i++) {
      slots.push({
        position: i,
        feed_type: 'winner',
        source_slot: winners[i]  // slot del que sale el equipo
      })
    }
  }
  
  return slots
}
```

### 5.3 Pairing strategies

El pairing de "1A vs 2B" no es trivial. Hay varios esquemas:

- **FIFA Mundial 2026**: patrón fijo publicado en regulations. Se hardcodea el orden.
- **UEFA Euro**: 1A vs 2C, 1B vs 3er A/D/E/F, etc (complejo).
- **Single elim genérico**: 1 vs 16, 2 vs 15, ..., o por seeding aleatorio.

Solución: tener varios `PairingStrategy` configurables:

```typescript
type PairingStrategy = 
  | 'fifa_world_cup_2026'  // hardcoded
  | 'uefa_euro'
  | 'simple_seeded'        // 1v16, 2v15, ...
  | 'random'
```

Para v2, soportar `simple_seeded` y `fifa_world_cup_2026` cubre el 90% de los casos. Otros se agregan on-demand.

---

## 6. UI considerations

### 6.1 Multi-tournament selector

Si hay varios tournaments activos, el usuario necesita elegir cuál ver:

```
Header: [Logo] [Tournament ▼] [User menu]
                  ├─ Mundial 2026 (active)
                  ├─ Copa América 2028
                  └─ Premier League 2025-26
```

Ruta: `/t/[slug]/...` (slug del tournament o season). Default: el último activo.

### 6.2 Branding por torneo

```typescript
// Server-side fetch del tournament, pasar a layout
const tournament = await getTournament(slug)
const theme = {
  '--color-primary': tournament.primary_color,
  '--logo-url': `url(${tournament.logo_url})`
}
```

CSS variables + tema dinámico. Hero, splash, iconos, todo custom por tournament.

### 6.3 URL structure

Opción A: **Subdominios**: `mundial.polla.app`, `champions.polla.app`. Más branding, más caro (cert SSL por subdominio).

Opción B: **Paths**: `polla.app/mundial-2026`, `polla.app/champions-2025`. Más simple, un solo dominio.

Recomendación: paths. Más simple, suficiente.

### 6.4 Si el usuario está en múltiples leagues del mismo tournament

Ej: estoy en "Liga Familia" y "Liga Oficina" del mismo Mundial. El ranking se duplica.

Solución: league selector, similar al tournament selector. Default: la league principal del usuario.

### 6.5 Componentes reusables

- `MatchCard`: cualquier match de cualquier deporte.
- `StandingsTable`: configurable (columnas: PJ/PG/PE/PP/GF/GC para fútbol, W/L/PCT/GB para NBA).
- `BracketTree`: visualiza `bracket_slots` con propagación.
- `PredictionForm`: según `prediction_type`, muestra los inputs correctos.

Los componentes leen config del schema, no hardcodean formato.

---

## 7. Esfuerzo de generalización

Sobre el MVP de v2 (estimado en ~136h en ROADMAP), agregar generalización multi-torneo.

### 7.1 Desglose

| Tarea | Horas |
|-------|-------|
| Diseñar schema genérico + migrations | 16 |
| Refactor `bracket-init.js` a `bracket-generator` configurable | 24 |
| `tournaments` + `seasons` CRUD admin | 16 |
| Import matches genérico (CSV / JSON / API) | 16 |
| UI multi-tournament selector + branding | 16 |
| Config de `prediction_types` por season | 12 |
| Config de `scoring_configs` por season | 8 |
| Refactor de admin UI para soportar cualquier formato | 24 |
| Tests del schema genérico + bracket generator | 24 |
| Migrations de v1 → v2 (un Mundial de prueba) | 8 |
| Documentación (este doc + ADR) | 8 |
| **Total generalización** | **~172 horas** |

### 7.2 Total MVP + generalización

- MVP base: 136h
- Generalización: 172h
- **Total: ~308 horas**

A 10h/semana: ~31 semanas, 7-8 meses. Esfuerzo significativo.

### 7.3 Alternativa incremental

No hacer todo de una. Enfoque por fases:

**Fase 1 (mes 1-3):** MVP genérico con Mundial 2026 como primer tenant. Refactor schema a genérico, mantener funcional. ~80h.

**Fase 2 (mes 4-5):** Agregar Champions League como segundo tenant. Validar que el schema soporta ambos. ~40h.

**Fase 3 (mes 6-7):** Generalizar UI (selector de tournament, branding). ~40h.

**Fase 4 (mes 8+):** Otros torneos (Copa América, Premier League, etc) on-demand.

Más realista, menos abrumador.

---

## 8. Naming y branding

Si generalizás, el nombre "Mundial 2026" ya no aplica. Opciones:

### 8.1 Opciones de nombre

| Nombre | Pros | Contras |
|--------|------|---------|
| **Polla** | simple, español, mercado primario | palabra con doble sentido en algunos países |
| **Pool** | claro, mercado amplio | genérico, sin branding |
| **Forecast** | amplio (no solo fútbol) | suena a clima |
| **Bracket** | técnico, claro para eliminatorias | no aplica a round-robin |
| **Pick'em** | estándar de la industria | inglés, no español |
| **MiPolla** | "mi" = personal, friendly | "polla" sigue siendo issue |
| **Polla2026** | timestamp en el nombre | no generaliza |
| **PollaHub** | brand de plataforma | pretencioso |
| **PollaFan** | comunidad | ok |
| **Penca** | palabra sudamericana para "polla" | regionalismos |
| **Pronóstico** | claro, español, no ambiguo | un poco largo |
| **Tanteador** | score en español | raro |

**Mi recomendación:** "Polla" con `.app` o `.fan` como dominio. Brand simple, memorable, español-friendly. Si en el futuro querés expandirte a otros mercados, "Pool" en inglés. El "issue" del doble sentido en algunos países se mitiga con branding serio (ej: "Polla - Predictions & Brackets").

### 8.2 Dominio

- `polla.app`: premium,可能在 resale.
- `polla.fan`: ok, .fan es TLD.
- `polla.club`: ok, .club es TLD.
- `mipolla.com`: si está disponible.
- `i-logic.net/polla`: subpath, ya tenés el dominio. **Recomendación inicial.**

### 8.3 Logo y branding

Para multi-torneo, el logo de la plataforma debe ser neutro (no decir "Mundial"). Algo como:

- Un trofeo estilizado
- Una pelota abstracta
- Una letra "P" estilizada
- Un bracket icon

El branding de cada tournament se sobrepone (colores, logo) en su vista.

---

## 9. Decisión pragmática

### 9.1 ¿Generalizar ahora o después?

**Argumentos para generalizar ahora:**
- Es más barato diseñar genérico desde el inicio que parchar específico.
- El Mundial 2026 es un caso, no es el caso general.
- Si vas a hacer v2 de cero, el costo incremental es ~50% (no 200%).

**Argumentos para NO generalizar ahora:**
- Si el v1 funciona y solo vas a usarlo para el Mundial, hardcodear es OK.
- El costo de diseñar genérico sin users reales es alto (over-engineering).
- Mejor validar con 1 caso real antes de generalizar.
- YAGNI: You Aren't Gonna Need It.

### 9.2 Recomendación

**Si vas a hacer v2 desde cero (Mundial 2030 o similar):** generalizá. Diseñá el schema genérico, hacé el MVP con Mundial 2026 como primer tenant, validá, después sumá Champions.

**Si vas a extender v1 (mantener para Mundial 2026, sumar Champions opcional):** no generalizás el schema todavía. Hacé un branch "experimental" para Champions con su propio schema, mantené ambos. Después, si funciona, merge.

**Si vas a hacer otro proyecto similar (no relacionado):** empezá genérico desde el día 1. No copies el schema de Mundial 2026 literalmente; aprendé los patrones y rehacé.

### 9.3 Criterio de decisión

Preguntate:

1. **¿Cuántos torneos vas a soportar en los próximos 12 meses?**
   - 1: no generalizás.
   - 2-3: considerá generalizar.
   - 4+: generalizá, es claro.

2. **¿Tenés tiempo para hacer v2 completo?**
   - Sí: generalizá.
   - No: extendé v1 con branches, sin generalizar.

3. **¿Querés que otros devs entiendan el código?**
   - Sí: schema genérico + docs.
   - No (es tu hobby personal): hardcoded está OK.

4. **¿Pensás monetizar o abrir a otros?**
   - Sí: generalizá, multi-tenancy es clave.
   - No: hobby, no inviertas de más.

Si 3 de 4 son "sí", generalizá. Si 3 de 4 son "no", no inviertas el esfuerzo.

---

## 10. Resumen ejecutivo

Si tuviera que darte 5 recomendaciones para multi-torneo:

1. **El 95% del código ya es genérico.** Auth, scoring, ranking, push, admin: todo se mantiene. Solo el schema de competición cambia. El esfuerzo incremental de generalizar es ~50% sobre el MVP, no 200%.

2. **Diseñá `tournaments` + `seasons` + `stages` como entidades de primer nivel.** Esto te da multi-torneo "gratis" si el schema está bien. El resto del modelo (matches, predictions, etc) se referencia a `season_id`.

3. **Bracket generator configurable, no hardcoded.** El v1 tiene `R32_FIXTURE` quemado. Para v2, un generador que recibe config (num_teams, pairing_strategy, source) y produce slots. Cubre Mundial, Champions, FA Cup, NBA playoffs con un solo código.

4. **Branding por tournament, plataforma neutra.** El logo y nombre de la plataforma no debe decir "Mundial". Es un detalle de UI, pero afecta el positioning a largo plazo. Cambiar el nombre después es caro.

5. **No intentes soportar todos los deportes desde el día 1.** Fútbol (con sus 5 variantes) cubre el 80% del mercado hobby. NBA/NFL se agregan después si hay demanda. Scope creep mata proyectos hobby.

Si llegaste hasta acá: el schema genérico es la pieza más importante. Si lo hacés bien, el resto se acomoda. Si lo hardcodeás a "Mundial", cada nuevo torneo es un rewrite.

---

**Última actualización:** Julio 2026. Antes de empezar el próximo proyecto, releer este doc + `ROADMAP.md` y decidir según el contexto del momento.
