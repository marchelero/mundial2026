# Mundial 2026 - Polla Mundialista

App web PWA para gestionar una polla (quiniela) del Mundial 2026 entre amigos. Los usuarios predicen resultados de cada partido, suman puntos por acierto exacto o signo, y compiten por un ranking con podio, menciones graciosas y export a Excel. El admin carga resultados, gestiona el bracket eliminatorio, dispara recordatorios push/WhatsApp y respalda la DB desde la UI.

**Stack:** Vue 3 (CDN, sin build step) + Express.js 4 + SQLite (better-sqlite3) + Google OAuth (ID token) + JWT (30d) + Web Push (VAPID) + WhatsApp (HTTP API) + ExcelJS + PWA.

**Live:** [mundial.i-logic.net](https://mundial.i-logic.net) · **Stack info:** 12 grupos (A-L), 104 partidos fase de grupos, R32 → R16 → QF → SF → Final, 40+ usuarios pre-cargados.

---

## Tabla de contenidos

- [Quick start (desarrollo)](#quick-start-desarrollo)
- [Configurar Google OAuth](#configurar-google-oauth)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue en cPanel](#despliegue-en-cpanel)
- [Features principales](#features-principales)
- [Sistema de puntos](#sistema-de-puntos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Scripts npm](#scripts-npm)
- [Troubleshooting](#troubleshooting)

---

## Quick start (desarrollo)

### Requisitos

- **Node.js 18+** ([descargar](https://nodejs.org/))
- **Git**
- Una cuenta de **Google** para crear el OAuth Client ID
- **Navegador moderno** (Chrome, Edge, Firefox)

### Setup

```bash
git clone <repo-url> mundial2026
cd mundial2026
npm install
cp .env.example .env
cp frontend/public/config.example.js frontend/public/config.js
```

Editá ambos archivos con tu `GOOGLE_CLIENT_ID` y `ADMIN_EMAILS` (ver [Variables de entorno](#variables-de-entorno)).

```bash
npm run dev
```

Esto arranca:
- **Backend API** → `http://localhost:3001`
- **Frontend SPA** → `http://localhost:3000` (proxea `/api/*` al backend)

Abrí `http://localhost:3000`, hacé click en **Iniciar sesión con Google** y elegí tu cuenta. Si tu email está en `ADMIN_EMAILS`, ves la solapa **Admin**.

### Modo producción local (un solo proceso)

```bash
npm start
# Sirve estáticos + API en http://localhost:3000
```

---

## Configurar Google OAuth

### 1. Crear proyecto en Google Cloud Console

1. Andá a [Google Cloud Console](https://console.cloud.google.com/)
2. Selector de proyectos → **NUEVO PROYECTO** → nombre: "Mundial 2026" → **CREAR**
3. **APIs y servicios** → **Pantalla de consentimiento de OAuth** → **Externo** → completar nombre + email de soporte → **GUARDAR Y CONTINUAR** (scopes y test users, dejá por defecto)
4. **PUBLICAR APLICACIÓN** (así cualquier usuario con Google puede loguearse)

### 2. Crear el Client ID

1. **APIs y servicios** → **Credenciales** → **+ CREAR CREDENCIALES** → **ID de cliente de OAuth**
2. Tipo: **Aplicación web** · Nombre: `Mundial 2026 Local`
3. **Orígenes de JavaScript autorizados** (uno por línea):
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   ```
4. **URIs de redireccionamiento**: no agregar nada
5. **CREAR** → copiar el **ID de cliente** (algo como `123456789-abc.apps.googleusercontent.com`)

Pegá ese ID en **dos archivos** (deben coincidir exactamente):
- `.env` → `GOOGLE_CLIENT_ID=...`
- `frontend/public/config.js` → `var GOOGLE_CLIENT_ID = '...';`

---

## Variables de entorno

### `.env` (backend)

```ini
NODE_ENV=development
PORT=3000

# Auth
JWT_SECRET=<generar-con-crypto-randomBytes-48>
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=tuemail@gmail.com,otro@gmail.com

# Puertos modo dev separado (no tocar)
BACKEND_PORT=3001
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:3001

# VAPID para Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu@email.com

# WhatsApp (opcional, HTTP API externa)
WHATSAPP_API_URL=https://api.example.com/send
WHATSAPP_API_KEY=...
WHATSAPP_GROUP_ID=...

# DB
DB_PATH=./data/mundial2026.db
```

### `frontend/public/config.js` (frontend)

```js
var ADMIN_EMAILS = ['tuemail@gmail.com'];
var GOOGLE_CLIENT_ID = 'tu-client-id.apps.googleusercontent.com';
var VAPID_PUBLIC_KEY = '...';  // misma que .env
```

> **Generar JWT_SECRET:** `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
>
> **Generar VAPID keys:** `npx web-push generate-vapid-keys`

---

## Despliegue en cPanel

### Setup Node.js App

1. **Setup Node.js App** → **Create Application**
2. **Node.js version:** 18+ · **Application mode:** Production
3. **Application root:** `/home/usuario/mundial2026`
4. **Application startup file:** `server.js`
5. **CREAR** → anotar el **puerto** asignado

### Subir archivos

Excluir siempre: `node_modules/`, `data/`, `.env`, `frontend/public/config.js`.

```bash
scp -r mundial2026/ usuario@tudominio.com:/home/usuario/
```

### Configurar producción

En el servidor:

```bash
cd /home/usuario/mundial2026
cp .env.example .env
cp frontend/public/config.example.js frontend/public/config.js
nano .env        # completar PORT, JWT_SECRET, GOOGLE_CLIENT_ID, ADMIN_EMAILS
nano frontend/public/config.js  # mismos valores
```

### Instalar y arrancar

Desde la UI: **Setup Node.js App** → **Run NPM Install** → **Start App**.

O por SSH:

```bash
cd /home/usuario/mundial2026
npm install --production
```

> **Si falla `better-sqlite3`:** pedirle al hosting que active `gcc`/`g++`/`make`/`python3`, o usar Node 18 LTS que trae prebuilt binaries.

### Actualizar Google OAuth para producción

En **Google Cloud Console** → Client ID → **Orígenes de JavaScript autorizados** agregar:
```
https://tudominio.com
https://www.tudominio.com
```

> SSL es obligatorio. El service worker, Google OAuth y VAPID requieren HTTPS.

Ver `README.cpanel.md` para guía extendida con troubleshooting de hosting.

---

## Features principales

### Para usuarios
- **Login con Google** (sin password, OAuth ID token verificado server-side)
- **Pronósticos por partido** con score exacto (3 pts), signo (1 pt), o comodín (×2)
- **Historial personal** con stats (racha actual, mejor racha, puntos por partido)
- **Ranking general** con podio animado, race chart, menciones graciosas y comparador 2-4 usuarios
- **Bracket eliminatorio** (R32 → R16 → QF → SF → Final) en vista lista o árbol
- **Pronóstico de campeón** (5 pts bonus, deadline 2026-06-28 15:00 Bolivia)
- **Web Push notifications** (recordatorio 15 min antes del partido)
- **PWA instalable** (Android/iOS standalone)
- **Vista pública** sin login: landing con race chart + podio + menciones

### Para admins
- **CRUD partidos** + carga manual de resultados (recalcula puntos automáticamente)
- **Gestión del bracket** (init/reset/auto-fill desde grupos, edición de teams, propagación de winners)
- **Recalcular puntos** global o por partido
- **Comodín máximo por usuario** (configurable vía setting)
- **Recordatorios** (ventana en minutos, antes del kickoff)
- **Backup/restore** de la DB desde la UI
- **Stream sources** (URLs HLS in-memory para transmisión)
- **Web Push** (stats + test)
- **WhatsApp** (trigger al cargar resultado + recordatorios)
- **Export a Excel** (XLSX con color-coding de puntos)
- **Asignar admins** (toggle por usuario)

---

## Sistema de puntos

| Situación | Puntos base | Con comodín |
|---|---|---|
| Resultado exacto (mismo score) | 3 | 6 |
| Acierto de signo (ganador/empate correcto, score distinto) | 1 | 2 |
| Error | 0 | 0 |
| Campeón acertado | 5 | — |

**Comodín:** configurable vía setting `comodin_max_per_user` (default 1). Se puede usar una sola vez por usuario en todo el torneo, multiplica los puntos ×2.

**Campeón:** se otorga manualmente vía `/api/champion-picks/award` cuando el admin confirma. Valida que el match final esté finalizado.

**Recálculo automático:** cuando un partido pasa a `status: 'finished'`, se recalculan todos los puntos de todos los usuarios (vía `services/scoring.js`).

**Cálculo de signo:**
- Pred `2-1`, real `3-0` → ganó local → acierto (1 pt)
- Pred `2-1`, real `0-1` → ganó visitante → error (0 pts)
- Empate en predicción: cualquier resultado con mismo signo (local=visitante) cuenta como acierto

Ver `docs/ARCHITECTURE.md` para detalle de `services/scoring.js`.

---

## Estructura del proyecto

```
mundial2026/
├── server.js                  Entry point combinado (prod: estáticos + API)
├── dev.js                     Arranca backend (3001) + frontend (3000) en child_process
├── package.json               v1.4.5, deps en package.json
├── .env / .env.example        Config backend
├── opencode.json              Config opencode
│
├── backend/                   API Node.js
│   ├── server.js              API standalone (dev)
│   ├── db.js                  SQLite init + migrations idempotentes
│   ├── middleware/auth.js     authRequired + adminRequired (JWT)
│   ├── routes/                auth, matches, predictions, champion, settings,
│   │                          users, groups, bracket, streams, push, backup, public
│   ├── services/              push (VAPID), whatsapp (HTTP), scoring
│   ├── jobs/reminders.js      setInterval 60s, recordatorios pre-match
│   ├── lib/                   bracket-init (R32/R16/QF fixtures),
│   │                          bracket-flow (propagation)
│   ├── data/countries.js      48 países con flag emoji + flagCode
│   └── utils/datetime.js      TZ America/La_Paz
│
├── frontend/                  SPA Vue 3
│   ├── server.js              Frontend standalone (proxy /api/* + estáticos)
│   └── public/
│       ├── index.html         Carga Vue global + hls.js + echarts + Google GIS
│       ├── app.js             createApp root + router (vista-based)
│       ├── sw.js              Service worker (v96, network-first HTML, cache-first assets)
│       ├── manifest.json      PWA standalone
│       ├── paises.js          48 países con confederation
│       ├── config.example.js  ADMIN_EMAILS + GOOGLE_CLIENT_ID + VAPID_PUBLIC_KEY
│       ├── assets/            Logos, fondos
│       ├── icons/             PWA icons
│       └── src/
│           ├── components/    Login, Layout, Landing, MatchList, Ranking,
│           │                  MyPredictions, Admin, Bracket
│           ├── services/      api (fetch wrapper), auth (GIS), game, push
│           └── utils/         helpers (nowStr TZ, calcPoints, flagUrl, formatDate)
│
├── data/
│   ├── matches.json           12 grupos (A-L) con teams + matches fase grupos
│   ├── users.json             40 emails pre-cargados
│   └── mundial2026.db         SQLite (gitignored, se crea solo)
│
├── scripts/                   Utilidades one-shot
│   ├── reset.js               drop DB o truncate tables
│   ├── seed.js                matches + users + results + predictions
│   ├── seed-results.js        solo results
│   ├── seed-predictions.js    solo predictions
│   ├── recalc-points.js       recalcula todos los puntos
│   ├── migrate_points.js      migración legacy
│   └── predictions-data.js    NAME_TO_EMAIL, P_MATCHES, PREDICTIONS, RESULTS
│
├── docs/
│   └── ARCHITECTURE.md        Detalle técnico por módulo + flujos
│
├── LICENSE.md
├── README.cpanel.md           Deploy cPanel extendido
└── README.md                  Este archivo
```

---

## API Endpoints

### Auth
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/google` | No | Login con Google (ID token) |
| `GET` | `/api/auth/me` | JWT | Datos del usuario actual |
| `POST` | `/api/auth/refresh` | JWT | Refresca JWT |

### Matches
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/matches` | No | Lista partidos (filtros: `?status=`, `?group=`) |
| `POST` | `/api/matches` | Admin | Crear partido |
| `PATCH` | `/api/matches/:id` | Admin | Actualizar (si `status→finished`, recalcula) |
| `DELETE` | `/api/matches/:id` | Admin | Eliminar |

### Predictions
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/predictions` | JWT | Filtros: `?user=`, `?match=` |
| `GET` | `/api/predictions/compare/:userId` | JWT | Pronóstico propio vs otro user |
| `GET` | `/api/predictions/match/:matchId` | JWT | Todos los pronósticos de un partido |
| `GET` | `/api/predictions/rankings` | JWT | Todos los pronósticos de partidos finalizados |
| `GET` | `/api/predictions/export` | Admin | Export completo |
| `POST` | `/api/predictions` | JWT | Crear/actualizar pronóstico (single) |
| `POST` | `/api/predictions/batch` | JWT | Múltiples pronósticos |
| `POST` | `/api/predictions/admin-bulk` | Admin | Upsert batch como admin |

### Champion
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/champion-picks` | JWT | Mi pick |
| `GET` | `/api/champion-picks/all` | JWT | Todos los picks |
| `POST` | `/api/champion-picks` | JWT | Crear/actualizar (valida `champion_pick_open` + deadline 2026-06-28) |
| `POST` | `/api/champion-picks/award` | Admin | Otorgar 5 pts al acertante |

### Settings
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/settings` | No | Lista settings |
| `POST` | `/api/settings` | Admin | Crear/actualizar |

### Users
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/users` | Admin | Lista usuarios |
| `POST` | `/api/users` | Admin | Crear usuario |
| `PUT` | `/api/users/:id` | Admin | Actualizar |
| `DELETE` | `/api/users/:id` | Admin | Eliminar |
| `GET` | `/api/users/unlinked` | Admin | Usuarios sin Google link |
| `GET` | `/api/users/rankings` | JWT | Ranking con `potential_points` |
| `POST` | `/api/users/recalculate-totals` | Admin | Recalcular `total_points` |
| `PATCH` | `/api/users/:id/admin` | Admin | Toggle admin |
| `GET` | `/api/users/rankings/mentions` | JWT | 18 menciones graciosas (ej: "El soñador", "Nostradamus al revés") |
| `GET` | `/api/users/rankings/export` | JWT | XLSX con color-coding de puntos |

### Groups
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/groups/standings` | No | PJ/PG/PE/PP/GF/GC/pts por grupo desde `matches.json` |

### Bracket
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/bracket` | No | Estado actual del bracket |
| `POST` | `/api/bracket/init` | Admin | Inicializar R32 con placeholders |
| `POST` | `/api/bracket/reset` | Admin | Resetear (con `?force=true` para borrar progreso) |
| `POST` | `/api/bracket/auto-fill` | Admin | Llenar con clasificados de grupos |
| `GET` | `/api/bracket/qualifiers` | No | Top 2 + mejores 3ros por grupo |
| `PATCH` | `/api/bracket/:id/team` | Admin | Setear team en un slot |
| `POST` | `/api/bracket/:id/winner` | Admin | Registrar ganador (propaga al siguiente match) |

### Streams
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/streams` | No | Stream sources (in-memory) |
| `POST` | `/api/streams` | Admin | Crear/actualizar |

### Push
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/push/subscribe` | JWT | Suscribir device |
| `DELETE` | `/api/push/subscribe` | JWT | Desuscribir |
| `GET` | `/api/push/vapid-key` | No | VAPID public key |
| `GET` | `/api/push/stats` | Admin | Stats de suscripciones |
| `POST` | `/api/push/test` | Admin | Test push al current user |

### Backup
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/backup` | Admin | Download `.db` (con WAL checkpoint) |
| `POST` | `/api/backup/restore` | Admin | Restore (base64, valida header SQLite + tablas requeridas) |

### Public (rate-limited 30/5min)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/public/landing-data` | No | Race chart + podium + mentions |
| `GET` | `/api/public/champion-winner` | No | Campeón actual (si awardado) |
| `GET` | `/api/public/mentions` | No | Menciones aleatorias |

### Health
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |

---

## Scripts npm

```bash
npm start                # Producción: server.js (estáticos + API, 1 proceso)
npm run dev              # Desarrollo: backend :3001 + frontend :3000
npm run backend          # Solo backend :3001
npm run frontend         # Solo frontend :3000 (con proxy a backend)

# Scripts de mantenimiento
node scripts/reset.js              # drop DB o truncate tables
node scripts/seed.js               # matches + users + results + predictions
node scripts/seed-results.js       # solo results
node scripts/seed-predictions.js   # solo predictions
node scripts/recalc-points.js      # recalcula todos los puntos
node scripts/migrate_points.js     # migración legacy
node scripts/backup.js             # backup manual (o desde UI Admin)
```

---

## Troubleshooting

| Problema | Causa y solución |
|---|---|
| Botón Google no aparece | F12 → Console. Si dice `GOOGLE_CLIENT_ID no configurado`, revisar `frontend/public/config.js`. Si dice `Google Identity Services no cargado`, revisar internet/bloqueador |
| Login redirige a `accounts.google.com/gsi/transform` y queda blanco | El `GOOGLE_CLIENT_ID` no está autorizado para el origen. Agregar `http://localhost:3000` (o el dominio de prod) en **Orígenes de JavaScript autorizados** del Client ID. Esperar 2 min y `Ctrl+Shift+R` |
| Página carga datos viejos | Service worker cacheó. `Ctrl+Shift+R` o DevTools → Application → Service Workers → Unregister |
| No veo la solapa Admin | Email no está en `ADMIN_EMAILS` (tanto en `.env` como en `frontend/public/config.js`) |
| `502 Bad Gateway` en `/api/*` | Backend no está corriendo. `npm run backend` en otra terminal |
| `better-sqlite3` falla al instalar | `npm install -g windows-build-tools` (Windows) o pedir `gcc`/`g++` al hosting. Node 18 LTS tiene prebuilt binaries |
| Push no llega | Revisar VAPID keys (deben coincidir en `.env` y `config.js`). Verificar permisos de notification en el browser. Revisar `/api/push/stats` |
| WhatsApp no envía | Verificar `WHATSAPP_API_URL`/`WHATSAPP_API_KEY`/`WHATSAPP_GROUP_ID` en `.env`. Revisar logs del backend |
| Backup restore falla | El archivo debe ser un SQLite válido (header `SQLite format 3\000`) y tener las tablas requeridas. Ver validación en `backend/routes/backup.js` |
| Bracket no aparece después de fase de grupos | Admin debe correr **Auto-fill** en `/admin` → Bracket, que llena R32 con clasificados |

Para detalle técnico por módulo y flujos, ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
