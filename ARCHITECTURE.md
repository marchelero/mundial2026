# Arquitectura Mundial 2026

Documento técnico de referencia. Cubre el modelo de datos, flujos críticos, decisiones de diseño y puntos de extensión.

**Audiencia:** developers que vayan a mantener o extender el proyecto.

---

## Tabla de contenidos

- [Vista general](#vista-general)
- [Capas y proceso único](#capas-y-proceso-único)
- [Modelo de datos (SQLite)](#modelo-de-datos-sqlite)
- [Auth: Google OAuth + JWT](#auth-google-oauth--jwt)
- [Predictions y scoring](#predictions-y-scoring)
- [Bracket eliminatorio](#bracket-eliminatorio)
- [Notificaciones: Push + WhatsApp](#notificaciones-push--whatsapp)
- [Jobs en background](#jobs-en-background)
- [Backup y restore](#backup-y-restore)
- [Frontend: Vue 3 SPA](#frontend-vue-3-spa)
- [PWA y service worker](#pwa-y-service-worker)
- [Settings y config dinámica](#settings-y-config-dinámica)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Puntos de extensión](#puntos-de-extensión)
- [Seguridad](#seguridad)

---

## Vista general

App monolítica con backend Express + frontend Vue 3 servidos desde el mismo proceso Node en producción. Sin build step en el frontend (Vue 3 vía CDN, componentes como funciones que retornan template strings).

```
Browser (PWA)
   │ HTTPS
   ▼
Node.js process (server.js)
   ├── Express API (/api/*)
   │     ├── middleware: helmet, compression, rate-limit, JWT
   │     ├── routes: auth, matches, predictions, champion,
   │     │          users, groups, bracket, streams,
   │     │          push, backup, public
   │     ├── services: scoring, push (web-push), whatsapp (HTTP)
   │     └── jobs: reminders (setInterval 60s)
   │
   ├── Static files (frontend/public/*)
   └── /config.js dinámico (lee process.env)
        │
        ▼
   SQLite (better-sqlite3, WAL mode)
   └── data/mundial2026.db
```

En desarrollo, `dev.js` separa backend (`:3001`) de frontend (`:3000`), donde el frontend hace proxy de `/api/*` al backend.

---

## Capas y proceso único

### Modo combinado (producción)

`server.js` (102 LOC) entry point:
1. Carga `.env` y monta Express
2. Aplica `helmet`, `compression`, `express.json()`, `cors`
3. Monta todas las routes en `/api/*`
4. Sirve estáticos desde `frontend/public/`
5. Inyecta `/config.js` dinámico leyendo `process.env` (asigna `window.APP_CONFIG` con `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `VAPID_PUBLIC_KEY`)
6. SPA fallback: cualquier ruta no-API → `index.html`
7. Arranca `jobs/reminders.js` después de 5s

### Modo dev separado

`dev.js` usa `child_process.spawn` para arrancar dos procesos:
- `node backend/server.js` (puerto 3001, solo API)
- `node frontend/server.js` (puerto 3000, estáticos + proxy)

El frontend usa `http-proxy-middleware` para redirigir `/api/*` a `BACKEND_URL`. Útil para hot-reload del frontend sin reiniciar el backend.

### Por qué un solo proceso en prod

cPanel con "Setup Node.js App" asigna un puerto y arranca un proceso. Tener API + estáticos en el mismo proceso simplifica el deploy y evita problemas de proxy inverso. El setInterval de reminders vive en el mismo proceso.

---

## Modelo de datos (SQLite)

DB: `data/mundial2026.db`. Modo WAL habilitado (`PRAGMA journal_mode=WAL`), `foreign_keys=ON`, `busy_timeout=5000`.

ID generator: 15 caracteres alfanum (`crypto.randomBytes`).

### Tablas

#### `users`
```sql
id            TEXT PK
email         TEXT UNIQUE NOT NULL
name          TEXT
picture       TEXT          -- URL de Google
google_id     TEXT          -- nullable (link lazy en primer login)
is_admin      INTEGER       -- 0/1, auto-set si email ∈ ADMIN_EMAILS
total_points  INTEGER DEFAULT 0
created_at    TEXT          -- ISO
```

#### `matches`
```sql
id           TEXT PK
phase        TEXT          -- 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
group_name   TEXT          -- 'A'..'L' (solo fase group)
home_team    TEXT
away_team    TEXT
home_flag    TEXT          -- emoji o flagCode
away_flag    TEXT
kickoff      TEXT          -- ISO datetime
status       TEXT          -- 'open' | 'finished'
home_score   INTEGER       -- null hasta finished
away_score   INTEGER
matchday     INTEGER       -- número de jornada
```

#### `predictions`
```sql
id            TEXT PK
user_id       TEXT FK → users.id
match_id      TEXT FK → matches.id
home_pred     INTEGER
away_pred     INTEGER
comodin       INTEGER       -- 0/1 (×2 puntos)
points        INTEGER       -- calculado al cerrar partido
created_at    TEXT
updated_at    TEXT
UNIQUE(user_id, match_id)
```

#### `champion_picks`
```sql
id            TEXT PK
user_id       TEXT FK → users.id UNIQUE
team          TEXT          -- nombre país
flag          TEXT          -- emoji
points        INTEGER       -- 5 si award, null en pick inicial
created_at    TEXT
```

#### `settings` (key-value)
```sql
key    TEXT PK
value  TEXT
```
Settings conocidos:
- `champion_pick_open` (`'1'` | `'0'`)
- `comodin_max_per_user` (default `'1'`)
- `reminder_minutes_before` (default `'15'`)

#### `push_subscriptions`
```sql
id           TEXT PK
user_id      TEXT FK
endpoint     TEXT
p256dh       TEXT
auth         TEXT
created_at   TEXT
UNIQUE(user_id, endpoint)
```

#### `match_reminders` (audit log)
```sql
id           TEXT PK
match_id     TEXT FK
user_id      TEXT FK
channel      TEXT          -- 'push' | 'whatsapp'
status       TEXT          -- 'sent' | 'failed'
sent_at      TEXT
```

#### `bracket_matches`
```sql
id            TEXT PK        -- 'P73'..'P104' (R32..Final)
phase         TEXT
home_team     TEXT           -- placeholder o team name
away_team     TEXT
home_flag     TEXT
away_flag     TEXT
home_source   TEXT           -- '1A' | '2B' | 'W73' (winner of P73)
away_source   TEXT
winner        TEXT           -- 'home' | 'away' | null
home_score    INTEGER
away_score    INTEGER
kickoff       TEXT
status        TEXT           -- 'pending' | 'finished'
```

### Migraciones idempotentes

`backend/db.js` corre `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE ADD COLUMN IF NOT EXISTS` (via try/catch en SQLite) al arrancar. La lista de columnas requeridas se valida y se agregan las que falten. Esto permite deploys sin pasos de migración manuales.

---

## Auth: Google OAuth + JWT

### Flow

```
Browser                          Backend                     Google
  │                                │                            │
  ├─── GIS button click ──────────►│                            │
  │                                │                            │
  │◄── Google popup (GIS) ────────┤                            │
  │                                │                            │
  ├─── ID token (JWT) ────────────┼─── POST /api/auth/google ─►│
  │                                │                            │
  │                                ├── verifyIdToken() ────────►│
  │                                │◄── payload {email,sub,...}─┤
  │                                │                            │
  │                                ├── UPSERT users            │
  │                                │   SET is_admin si          │
  │                                │   email ∈ ADMIN_EMAILS     │
  │                                │                            │
  │                                ├── jwt.sign(               │
  │                                │     { id, email,           │
  │                                │       is_admin },          │
  │                                │     JWT_SECRET,            │
  │                                │     { expiresIn: '30d' })  │
  │                                │                            │
  │◄── { token, user } ────────────┤                            │
  │                                │                            │
  ├── localStorage.setItem         │                            │
  │   ('auth_token', token)        │                            │
  │                                │                            │
  └─── fetch('/api/...',          │                            │
         { Authorization:          │                            │
           'Bearer ' + token }) ──►│                            │
                                  │                            │
                                  ├── jwt.verify()            │
                                  ├── req.user = decoded      │
```

### Middleware

`backend/middleware/auth.js`:
- `authRequired`: lee `Authorization: Bearer <token>`, verifica con `JWT_SECRET`, setea `req.user = { id, email, is_admin }`. 401 si falta o es inválido.
- `adminRequired`: 403 si `req.user.is_admin !== 1`.

### Frontend

`frontend/public/src/services/api.js`: wrapper de `fetch` que lee el token de `localStorage` y lo agrega como Bearer. Si recibe 401, limpia el token y dispara evento para redirect al login.

`frontend/public/src/services/auth.js`: usa Google Identity Services (GIS, cargado desde CDN) para renderizar el botón. `loginGoogle()` devuelve el ID token, lo postea a `/api/auth/google`, guarda el token en `localStorage` y emite un evento global `auth:login`.

### Lazy linking

Si un email está en `data/users.json` (pre-cargado) pero nunca hizo Google login, queda con `google_id=NULL`. Al primer login, se linkea el `google_id` sin crear usuario nuevo.

### Refresh

`POST /api/auth/refresh` re-firma el JWT con la misma data. Útil si el cliente nota que el token está cerca de expirar (30d es largo, pero permite extender sin re-login).

---

## Predictions y scoring

### Crear/actualizar predicción

```
POST /api/predictions { match_id, home_pred, away_pred, comodin? }
   │
   ├── authRequired
   ├── valida match existe y status='open'
   ├── valida comodin_max_per_user (lee setting)
   ├── UPSERT en predictions
   └── 200 { ok: true }
```

### Cálculo de puntos (`backend/services/scoring.js`)

```js
function calcPointsForPred(predHome, predAway, realHome, realAway, comodin) {
  if (predHome === realHome && predAway === realAway) {
    return 3 * (comodin ? 2 : 1)  // exacto
  }
  // signo: ganó local / visitante / empate
  const predSign = Math.sign(predHome - predAway)
  const realSign = Math.sign(realHome - realAway)
  if (predSign === realSign) {
    return 1 * (comodin ? 2 : 1)  // signo
  }
  return 0  // error
}
```

### Recálculo al cerrar partido

`PATCH /api/matches/:id` con `status: 'finished'`:
1. Update match
2. `recalcAndSavePointsForMatch(matchId)`:
   - Para cada prediction del match: `points = calcPointsForPred(...)`
   - UPDATE predictions SET points
3. `recalcUserTotal(userId)` para todos los users afectados:
   - `UPDATE users SET total_points = (SELECT SUM(points) FROM predictions WHERE user_id=?)`
4. Disparar `sendMatchResultPush(matchId)` + `sendMatchResult(matchId)` (WhatsApp)

### Race chart (frontend)

`Landing.js` + `Ranking.js` usan ECharts para graficar la evolución de puntos por usuario a lo largo de los partidos finalizados. Query: para cada `match_id` ordenado por `kickoff`, sumar puntos hasta ese match por usuario. Renderiza línea por usuario.

### Menciones

`GET /api/users/rankings/mentions`: para cada usuario en el ranking, le asigna una mención basada en su posición/stats. 18 categorías:
- "Más afortunado" (más puntos con comodín)
- "El soñador" (más picks con resultado exacto fallido por goleada)
- "Nostradamus al revés" (más picks donde el resultado real fue el opuesto)
- "El comodín perdido" (usó comodín y erró)
- "Rey del empate" (más picks de empate)
- "Underdog master" (más picks acertados donde ganó el "débil")
- ...

Rotación aleatoria al pedir (mismo usuario puede tener menciones distintas en calls distintos).

---

## Bracket eliminatorio

### Fases

R32 (16 partidos P73-P88) → R16 (8 partidos P89-P96) → QF (4 partidos P97-P100) → SF (2 partidos P101-P102) → Third (1 partido P103) → Final (1 partido P104).

Total: 32 partidos en bracket.

### Fixture

`backend/lib/bracket-init.js` exporta fixtures hardcodeados:
- `R32_FIXTURE`: 16 partidos con `home_source` y `away_source` (placeholders tipo `'1A'`, `'2B'`, `'W73'` — el ganador del partido P73)
- `R16_FIXTURE`: 8 partidos cuyas fuentes son winners de R32
- `QF_FIXTURE`: 4 partidos
- `SF_FIXTURE`: 2 partidos
- `THIRD_FIXTURE`: 1 partido (perdedores de SF)
- `FINAL_FIXTURE`: 1 partido

`BRACKET_SCHEDULE`: kickoff de cada match (fechas oficiales del mundial).

### Init

`POST /api/bracket/init` (admin): crea los 32 partidos en `bracket_matches` con placeholders (`home_team = '1A'`, etc.) y `status='pending'`.

### Auto-fill

`POST /api/bracket/auto-fill` (admin): toma los 2 primeros + mejores 8 terceros de la fase de grupos, los asigna a los slots R32 según el fixture. Solo funciona si todos los partidos de grupo están `finished`.

`getQualifiersFromGroups()` en `bracket-init.js`: lee los partidos finalizados, calcula standings, devuelve `{ groupA: ['1A', '2A', '3A'], ... }` y los 8 mejores terceros.

### Winner propagation

`POST /api/bracket/:id/winner` (admin):
1. Set `winner = 'home' | 'away'` en el match
2. Lee `winner_team` del partido
3. Busca matches downstream que tengan `home_source = 'W{id}'` o `away_source = 'W{id}'`
4. UPDATE `home_team` o `away_team` en esos matches con el team ganador
5. Si el match downstream ya tenía un team hardcodeado (ej: Third place es perdedor de SF), se llama `propagateLoser` (no implementado actualmente, se setea manual)

`bracket-flow.js` tiene `getNextMatch(matchId)` y `propagateWinner(matchId, winnerTeam)` para la lógica.

### Visualización

`frontend/public/src/components/Bracket.js` (964 LOC):
- Vista **lista**: rounds agrupados, cards con team logos + score editable
- Vista **árbol**: SVG con líneas de conexión entre matches (responsive, scroll horizontal en mobile)

Admin puede editar teams y winners desde la UI. Winner pide confirmación.

---

## Notificaciones: Push + WhatsApp

### Web Push (`backend/services/push.js`)

Usa `web-push` con VAPID. Flujo:
1. Frontend pide `GET /api/push/vapid-key` (público)
2. `subscribeToPush()` en `frontend/public/src/services/push.js`:
   - Espera `serviceWorker.ready`
   - `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <vapid> })`
   - `POST /api/push/subscribe` con el `PushSubscription`
3. Backend guarda en `push_subscriptions`
4. Para enviar: `webpush.sendNotification(subscription, JSON.stringify(payload))`

Payload típico: `{ title, body, icon, url, matchId? }`.

`sendMatchResultPush(matchId)`: itera todos los users con prediction en ese match, les manda push con el resultado.

`sendChampionPickPush(...)`: similar para campeón.

### WhatsApp (`backend/services/whatsapp.js`)

HTTP POST a API externa (configurada vía `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, `WHATSAPP_GROUP_ID`). Asume un endpoint tipo:
```
POST {WHATSAPP_API_URL}
Headers: Authorization: Bearer {WHATSAPP_API_KEY}
Body: { group_id, message }
```

Mensajes se construyen con formato markdown-lite (emojis, negritas con `*`).

Funciones:
- `sendMatchResult(matchId)`: notifica resultado + puntos del match
- `sendWhatsAppPredictions(userId)`: envía predicciones pendientes (al registrarse)
- `sendChampionPick(userId)`: confirma pick de campeón
- `sendChampionAward(userId)`: notifica que ganó 5 pts de campeón

Si `WHATSAPP_API_URL` no está configurado, las funciones son no-op (try/catch con warning log).

---

## Jobs en background

`backend/jobs/reminders.js`: setInterval 60s.

Cada tick:
1. Lee setting `reminder_minutes_before` (default 15)
2. Query matches con `status='open'` y `kickoff` en ventana `[now, now + N min]`
3. Para cada match:
   - Busca users que NO tienen prediction para ese match
   - Para cada user: envía push (si tiene subscription) y WhatsApp (si está configurado)
   - Inserta en `match_reminders` con `status='sent' | 'failed'`
4. Log: "reminders sent: X, failed: Y"

Filtros: no re-enviar si ya hay `match_reminders` para ese `(user, match, channel)`.

Arranca 5s después del server (timeout en `server.js`) para no bloquear el startup si la DB no está lista.

---

## Backup y restore

### Backup

`GET /api/backup` (admin):
1. `db.pragma('wal_checkpoint(FULL)')` — flushes del WAL al archivo principal
2. `res.download(DB_PATH)` con nombre `mundial2026_YYYYMMDD_HHMMSS.db`

### Restore

`POST /api/backup/restore` (admin):
1. Body: `{ data: '<base64 del .db>' }`
2. Decodifica a Buffer
3. Valida header: primeros 16 bytes deben ser `SQLite format 3\000`
4. Valida tablas requeridas: query `SELECT name FROM sqlite_master WHERE type='table'` debe incluir `users`, `matches`, `predictions`, etc.
5. Cierra la DB actual, reemplaza el archivo, reabre
6. `db.pragma('wal_checkpoint(FULL)')` para regenerar WAL
7. Re-corre migraciones idempotentes (por si el backup tiene schema más viejo)

Validación robusta: rechaza archivos que no son SQLite o que les faltan tablas críticas. Evita inyección de archivos maliciosos.

---

## Frontend: Vue 3 SPA

### Setup

`index.html` carga en orden:
1. `config.js` (define `window.APP_CONFIG`)
2. Vue 3 global (CDN)
3. hls.js 0.14.17
4. ECharts 5
5. Google Identity Services
6. `app.js`

### Routing (vista-based, sin vue-router)

`app.js` mantiene `currentView` (ref reactivo). El root component usa `<component :is="currentView">` para swapear. Las views son funciones que retornan template strings.

Views: `Login`, `Landing`, `Layout` (con bottom-nav), `MatchList`, `Ranking`, `MyPredictions`, `Admin`, `Bracket`.

### Componentes

`frontend/public/src/components/*.js`: cada uno exporta un objeto Vue con `template`, `data()`, `computed`, `methods`, `mounted`. Sin SFC (no hay build step).

Estructura típica de un componente:
```js
export const MatchList = {
  template: `
    <div>
      <div v-for="m in matches" :key="m.id">
        {{ m.home_team }} vs {{ m.away_team }}
      </div>
    </div>
  `,
  data() { return { matches: [], activeTab: 'today' } },
  computed: {
    todayMatches() { /* filter */ },
  },
  async mounted() { this.matches = await loadMatches() },
  methods: { savePred(p) { /* ... */ } },
}
```

### State management

Sin Pinia/Vuex. El root `app.js` mantiene:
- `user` (ref): user actual (de `auth/me`)
- `token` (ref): JWT
- `currentView` (ref): qué view renderizar
- `predictions` (ref): predicciones del user actual
- `settings` (ref): settings globales

Las components hacen fetch directo a `services/api.js` y emiten cambios al root vía callbacks o mutando refs compartidos.

Computed cross-component: `userStreak`, `userRank`, `maxStreak`, `pendingTodayCount` viven en root y son accesibles.

### Services

- `api.js`: `apiGet(path)`, `apiPost(path, body)`, `apiPatch`, `apiDelete`. Lee token de `localStorage`, agrega Bearer, parsea JSON, lanza error si status >= 400.
- `auth.js`: `renderGoogleButton(elementId)`, `loginGoogle()`, `logout()`, `refreshAuth()`.
- `game.js`: high-level wrappers (`loadMatches`, `savePrediction`, `loadChampionPick`, etc.) que usan `api.js`.
- `push.js`: `subscribeToPush()`, `unsubscribeFromPush()`.

### Utils

`frontend/public/src/utils/helpers.js`:
- `nowStr()`: datetime actual en `America/La_Paz`
- `calcPoints(pred, real, comodin)`: mirror del backend
- `formatDate(iso)`: locale es-BO corto
- `roundLabel(phase)`: "Fase de grupos", "R32", "Octavos", etc.
- `groupLabel(groupName)`: "Grupo A"
- `flagUrl(code)`: `https://flagcdn.com/24x18/${code}.png`

### PWA install prompt

`app.js` captura `beforeinstallprompt` event, lo guarda en `deferredPrompt`, expone botón "Instalar app" en el header. En click: `deferredPrompt.prompt()`.

---

## PWA y service worker

`frontend/public/sw.js` (v96):

Estrategia:
- **HTML/JS**: network-first (intenta red, fallback a cache). Garantiza updates.
- **CSS/images**: cache-first (rápido, asume que no cambian).
- **API**: NO se cachea. Siempre va a red.

Lifecycle:
1. `install`: `cache.addAll([...])` con shell mínimo (`/`, `/index.html`, `/app.js`, `/style.css`, `/manifest.json`)
2. `activate`: limpia caches viejos (`cacheNames.filter(c => c !== CACHE_NAME)`)
3. `fetch`: intercepta según tipo de recurso

Push handler:
```js
self.addEventListener('push', event => {
  const data = event.data.json()
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    data: { url: data.url }
  })
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

Bump de versión: cambiar `CACHE_NAME` y `version` en `sw.js` para forzar refresh.

---

## Settings y config dinámica

### Settings dinámicos (DB)

`/api/settings` key-value en `settings` table. Consumidos por backend en runtime (ej: `comodin_max_per_user` se lee en cada `POST /api/predictions`).

### Config estática (env)

`/config.js` dinámico: cada request a `/config.js` devuelve un JS generado que lee `process.env`:
```js
window.APP_CONFIG = {
  ADMIN_EMAILS: process.env.ADMIN_EMAILS?.split(',') || [],
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
};
```

Esto permite tener UN solo build que se configura en runtime según env (no hay que rebuild para prod).

Frontend lee `window.APP_CONFIG` en `app.js` antes de montar.

### Variables de build (no se commitean)

- `frontend/public/config.js` (gitignored, generado de `config.example.js`)
- `.env` (gitignored, generado de `.env.example`)

---

## Decisiones de diseño

### 1. Vue 3 sin build step

**Pro:** cero tooling, deploy simple, debug fácil en DevTools. **Con:** template strings son ruidosos, no hay type-checking, no hay HMR. **Cuándo reconsiderar:** si el proyecto crece > 10 components o se necesita compartir tipos con backend.

### 2. SQLite (better-sqlite3)

**Pro:** trivial de operar, backup = cp, sincronous (sin race conditions). **Con:** single-writer (WAL mitiga). **Cuándo reconsiderar:** si se necesita > 1 instancia o > 100 writes/sec.

### 3. Express monolítico

**Pro:** simple, todo en un proceso. **Con:** jobs y API comparten event loop. **Cuándo reconsiderar:** si se necesita escalar API independientemente o jobs bloqueantes.

### 4. JWT 30d

**Pro:** usuarios no re-loguean en todo el torneo. **Con:** si se filtra el token, dura 30d. **Mitigación:** HTTPS obligatorio, `helmet` + rate-limit, monitoring de uso anormal.

### 5. Push + WhatsApp como best-effort

**Pro:** no bloquea el flow principal. **Con:** si fallan, no se reintenta automáticamente. **Mitigación:** audit log en `match_reminders`, dashboard de stats.

### 6. Bracket manual

**Pro:** control total del fixture. **Con:** admin debe cargar winners manualmente. **Mitigación:** "Auto-fill" desde grupos y propagación automática de winners al siguiente match.

### 7. Menciones hardcodeadas (18 frases)

**Pro:** simples, sin generación de texto. **Con:** repetitivas. **Cuándo reconsiderar:** si se quiere variación infinita o personalizadas por stats.

---

## Puntos de extensión

### Agregar un nuevo tipo de notificación

1. Crear `backend/services/<channel>.js` con `send(channel, payload)`
2. Agregar setting en `db.js` (idempotente)
3. Disparar desde `services/scoring.js` (post-recalc) o `jobs/reminders.js`
4. Agregar UI en `Admin.js` para test

### Agregar un nuevo campo a predictions

1. Migración idempotente en `db.js`: `ALTER TABLE predictions ADD COLUMN ...`
2. Update `POST /api/predictions` para aceptar/guardar
3. Update `services/scoring.js` si afecta puntos
4. Update frontend `MyPredictions.js` y form de predicción

### Agregar un nuevo endpoint público

1. Crear route en `backend/routes/<name>.js`
2. Montar en `backend/server.js` y `server.js`
3. Aplicar rate-limit si lo necesita
4. Consumir en frontend via `services/api.js`

### Cambiar el sistema de scoring

1. Modificar `calcPointsForPred` en `backend/services/scoring.js`
2. Correr `node scripts/recalc-points.js` para retroactivo
3. Update tabla de puntos en `README.md`

### Internacionalización

Las strings están hardcodeadas en español. Para i18n:
1. Crear `frontend/public/src/i18n.js` con diccionarios `es`/`en`
2. Helper `t(key)` que busca en diccionario activo
3. Reemplazar strings en templates
4. Selector de idioma en `Layout.js`

---

## Seguridad

### Implementado

- **HTTPS obligatorio** en prod (SW + OAuth + VAPID lo requieren)
- **Helmet**: headers seguros (CSP, X-Frame-Options, etc.)
- **Rate limit**: 100 req/15min general, 30/5min en `/api/public/*`
- **JWT con expiración** (30d) + verify en cada request
- **google-auth-library verifyIdToken**: valida firma, audience, expiry
- **CORS** restrictivo (solo origins permitidos en prod)
- **Backup validation**: header SQLite + tablas requeridas antes de restore
- **No secrets en código**: `.env` y `config.js` gitignored
- **Input validation**: Zod en routes nuevas (ver `INSTRUCTIONS.md`)

### Pendiente / considerar

- **CSRF**: no implementado (JWT en header no requiere, pero revisar si se agregan cookies)
- **SQL injection**: mitigado por better-sqlite3 (prepared statements en todo `db.js`)
- **XSS**: Vue 3 escapa por default, no usar `v-html` con user input
- **Admin privilege escalation**: validar `is_admin` server-side en cada endpoint admin (ya implementado)
- **Audit log**: considerar tabla `audit_log` para acciones admin sensibles
- **2FA**: no implementado (Google OAuth es la única auth, depende de Google)
- **Token rotation**: considerar refresh tokens con revocación

### Reporte de vulnerabilidades

Encontraste un bug de seguridad? Email directo al maintainer (ver `package.json` author). NO abrir issue público hasta que se parche.
