# Mundial 2026 - Polla Mundialista

App web para gestionar una **polla (quiniela) del Mundial 2026**. Los usuarios registran sus pronósticos, se calculan puntos automáticamente y el admin exporta todo a CSV.

## Stack

- **Frontend:** Vue 3 (CDN) — SPA sin build step
- **Backend:** Express.js + SQLite (better-sqlite3) — un solo proceso Node
- **Auth:** Google OAuth2 (Google Identity Services) + JWT propio
- **Seguridad:** Helmet, Rate Limiting
- **Performance:** Compresión gzip, índices en BD
- **PWA:** Instalable en celular (manifest.json + service worker)
- **Despliegue target:** cPanel con "Setup Node.js App" (Passenger)

## Requisitos

- Node.js 18 o superior
- cPanel con "Setup Node.js App" habilitado (para producción)
- Un proyecto de Google Cloud con OAuth Client ID configurado

## Cómo levantar el proyecto (local)

### 1. Clonar y entrar

```bash
git clone <repo> mundial2026
cd mundial2026
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno del backend

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=un-string-aleatorio-largo-y-seguro
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=tu@email.com
```

> El `JWT_SECRET` lo generás con `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.

### 4. Configurar el frontend

```bash
cp public/config.example.js public/config.js
```

Editar `public/config.js`:

```js
var ADMIN_EMAILS = ['tu@email.com'];
var GOOGLE_CLIENT_ID = 'tu-client-id.apps.googleusercontent.com';
```

> El `GOOGLE_CLIENT_ID` tiene que ser **el mismo** que está en `.env`. Solo los usuarios con emails en `ADMIN_EMAILS` ven la solapa **Admin**.

### 5. Iniciar el servidor

```bash
npm run dev
```

Esto inicia el servidor en `http://localhost:3000` con hot-reload.

### 6. Configurar Google OAuth

En [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Crear proyecto → "Credentials" → "Create OAuth client ID"
2. Tipo: **Web application**
3. **Authorized JavaScript origins:** agregar las URLs desde donde se va a usar la app, una por línea:
   - `http://localhost:3000` (desarrollo)
   - `https://tudominio.com` y/o `https://www.tudominio.com` (producción)
4. Copiar el **Client ID** y pegarlo en `.env` y `public/config.js`
5. Guardar y esperar 1-2 minutos para que propague

### 7. Probar

Abrir `http://localhost:3000/`, hacer clic en el botón de Google, elegir tu cuenta. Debería llevarte a la pantalla principal de la app.

## Cómo se usa

### Usuario normal

1. **Login** con Google
2. **Pronóstico campeón** — elegir el campeón del mundial (+5 pts bonus)
3. **Votar** — ingresar resultados de cada partido
   - Se puede usar el **comodín** en 1 partido (duplica puntos)
   - Los pronósticos se guardan y **no se pueden editar**
4. **Posiciones** — tabla de puntajes actualizada automáticamente
5. **Pronósticos** — historial de partidos pasados con puntos

### Admin

El admin además ve la solapa **Admin** donde puede:

1. **Agregar partidos** — selector con los 48 países clasificados, fecha, hora y ronda
2. **Cargar resultados** — ingresar scores reales (los puntos se calculan automáticamente)
3. **Exportar CSV** — descargar todo en formato tabla para Google Sheets
4. **Exportar por partido** — descargar predicciones de un partido específico

### Sistema de puntos

| Situación | Puntos |
|-----------|--------|
| Resultado exacto | 3 |
| Acierto de ganador/empate | 1 |
| Error | 0 |
| Comodín | ×2 |
| Campeón acertado | +5 |

## Estructura del proyecto

```
mundial2026/
├── server.js              ← Entry point
├── package.json
├── db.js                  ← SQLite: crea tablas automáticamente
├── middleware/
│   └── auth.js            ← JWT: authRequired + adminRequired
├── routes/
│   ├── auth.js            ← Google OAuth → JWT
│   ├── matches.js         ← CRUD partidos
│   ├── predictions.js     ← CRUD pronósticos + rankings
│   ├── champion.js        ← Pronóstico campeón
│   └── settings.js        ← Configuración admin
├── data/                  ← SQLite DB (se crea sola, gitignored)
├── public/                ← Frontend estático
│   ├── index.html
│   ├── config.js          ← Configuración frontend (gitignored)
│   ├── app.js             ← Vue 3 app principal
│   ├── style.css
│   ├── paises.js          ← 48 países clasificados
│   ├── manifest.json
│   ├── sw.js              ← Service Worker
│   └── src/
│       ├── components/    ← Componentes Vue
│       ├── services/      ← API client + auth
│       └── utils/         ← Helpers
└── .env                   ← Variables de entorno (gitignored)
```

## API Endpoints

### Auth
- `POST /api/auth/google` — Verifica token Google, retorna JWT
- `GET /api/auth/me` — Retorna usuario actual (requiere token)
- `POST /api/auth/refresh` — Refresca token JWT

### Matches
- `GET /api/matches` — Lista todos los partidos
- `POST /api/matches` — Crea partido (admin)
- `PATCH /api/matches/:id` — Actualiza partido (admin)
- `DELETE /api/matches/:id` — Elimina partido (admin)

### Predictions
- `GET /api/predictions?user=<userId>` — Pronósticos del usuario
- `GET /api/predictions/match/:matchId` — Pronósticos de un partido
- `GET /api/predictions/rankings` — Todos los pronósticos de partidos finalizados
- `GET /api/predictions/export` — Export completo (admin)
- `POST /api/predictions` — Crear pronóstico

### Champion Picks
- `GET /api/champion-picks` — Pronóstico del campeón del usuario
- `GET /api/champion-picks/all` — Todos los pronósticos de campeón
- `POST /api/champion-picks` — Crear/actualizar pronóstico de campeón

### Settings
- `GET /api/settings` — Lista configuración
- `POST /api/settings` — Crear/actualizar setting (admin)

## Despliegue en cPanel

### 1. Subir archivos

Subir todo al servidor **excepto** `node_modules/`, `data/`, `.env`, `public/config.js`. El `.gitignore` ya excluye estos.

```bash
# Opción A: clonar
git clone <repo> /home/usuario/mundial2026

# Opción B: SCP
scp -r mundial2026/ usuario@host:/home/usuario/
```

### 2. Crear la app en cPanel

Ir a **Setup Node.js App** > **Create Application**:

- **Node version:** 18 o superior
- **Application mode:** Production
- **Application root:** `/home/usuario/mundial2026`
- **Application URL:** tu-dominio.com (o subdominio)
- **Application startup file:** `server.js`

Anotá el **puerto** que cPanel le asigna (ej: 3000).

### 3. Configurar variables de entorno

Crear/editar `.env` en el root de la app (NO la subas por git, tiene secretos):

```bash
PORT=<puerto_que_asigno_cpanel>
NODE_ENV=production
JWT_SECRET=<string-aleatorio-largo-generado-con-crypto>
GOOGLE_CLIENT_ID=<tu-client-id>.apps.googleusercontent.com
ADMIN_EMAILS=tu@email.com
```

También copiá el config del frontend (puede ser el mismo client_id y los mismos emails):

```bash
cp public/config.example.js public/config.js
# editar con los mismos valores que en .env
```

### 4. Instalar dependencias

Opción A (SSH):
```bash
cd /home/usuario/mundial2026
npm install --production
```

Opción B (cPanel UI): seleccionar la app y clic en **Run NPM Install**.

> Si `better-sqlite3` falla al compilar (módulo nativo), pedile al hosting que active el build toolchain (python, make, g++) o que use un Node con prebuilt binaries disponibles.

### 5. Reiniciar la app

En cPanel UI: seleccionar la app > **Restart**.

Por SSH:
```bash
touch /home/usuario/mundial2026/tmp/restart.txt
```

### 6. Verificar

- Abrir `https://tu-dominio.com` — debería cargar la app
- Probar el login con Google — si redirige a `accounts.google.com/gsi/transform` y queda en blanco, revisá los **Authorized JavaScript origins** del Client ID en Google Cloud (debe incluir tu dominio EXACTO con https)
- Probar el admin: entrar con un email que esté en `ADMIN_EMAILS` y verificar que aparezca la solapa Admin

### 7. SSL

El service worker y Google OAuth requieren HTTPS. Activá el certificado SSL de cPanel (Let's Encrypt es gratuito) antes de probar el login.

## Backups

La base de datos es un archivo SQLite en `data/mundial2026.db`.

Para hacer backup:

```bash
cp data/mundial2026.db /ruta/backup/mundial2026_$(date +%Y%m%d).db
```

Automatizar con cron:

```bash
0 3 * * * cp /ruta/mundial2026/data/mundial2026.db /ruta/backups/mundial2026_$(date +\%Y\%m\%d).db
```

## Comandos útiles

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start

# Test de salud
npm test
# → hace curl a /api/health y muestra la respuesta

# Generar un JWT_SECRET seguro
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## Características de seguridad

- **Helmet:** Headers HTTP seguros + CSP estricto
- **Rate Limiting:**
  - 1000 requests/15min para API general
  - 20 requests/15min para `/api/auth/*`
- **JWT:** Tokens con expiración de 7 días, firmados con `JWT_SECRET`
- **Validación:** Todos los inputs se validan en backend
- **Compresión:** gzip para mejor performance
- **Archivos sensibles protegidos:** `.htaccess` bloquea acceso a `.env`, `server.js`, `db.js`, `data/`, `node_modules/`

## Estructura del proyecto

```
mundial2026/
├── server.js              ← Entry point Express
├── db.js                  ← SQLite: crea tablas automáticamente
├── package.json
├── app.json               ← Metadata para cPanel Passenger
├── passengerfile.json     ← Configuración Passenger
├── .env.example
├── middleware/
│   └── auth.js            ← JWT: authRequired + adminRequired
├── routes/
│   ├── auth.js            ← Google OAuth → JWT
│   ├── matches.js         ← CRUD partidos
│   ├── predictions.js     ← CRUD pronósticos + rankings
│   ├── champion.js        ← Pronóstico campeón
│   └── settings.js        ← Configuración admin
├── data/                  ← SQLite DB (se crea sola, gitignored)
├── public/                ← Frontend estático
│   ├── .htaccess          ← Apache rules (cPanel)
│   ├── index.html
│   ├── config.js          ← Configuración frontend (gitignored)
│   ├── app.js             ← Vue 3 app principal
│   ├── style.css
│   ├── paises.js          ← 48 países clasificados
│   ├── manifest.json
│   ├── sw.js              ← Service Worker
│   └── src/
│       ├── components/    ← Componentes Vue
│       ├── services/      ← API client + auth
│       └── utils/         ← Helpers
├── deploy.sh              ← Script de despliegue
└── .env                   ← Variables de entorno (gitignored)
```

## Posibles problemas

- **Login queda en blanco en `accounts.google.com/gsi/transform`**
  → El Client ID de `public/config.js` no coincide con el de `.env`, o el dominio no está en "Authorized JavaScript origins" de Google Cloud Console.

- **No se ve la solapa Admin**
  → El email con el que logueás no está en `ADMIN_EMAILS` (en `.env`) ni en `public/config.js`. Comparar case-insensitive.

- **Error 502 en cPanel**
  → El `PORT` en `.env` no coincide con el puerto que cPanel asignó. O la app no terminó de iniciar (revisar logs).

- **`better-sqlite3` no instala**
  → El hosting no tiene build tools. Pedir python + make + g++, o usar un Node que tenga prebuilt binaries (Node 18 LTS suele tenerlos).

- **La base de datos se borró tras un deploy**
  → Asegurate de no subir/eliminar la carpeta `data/`. El `.gitignore` la excluye, pero si re-subís todo el contenido, se borra. Hacer backup antes de cualquier deploy (`cp data/mundial2026.db backup.db`).

- **Error de CORS en consola del navegador**
  → El frontend usa `window.location.origin` para llamar al backend, así que CORS no debería ser problema si están en el mismo dominio. Si usás subdominios distintos, ajustá el CSP en `server.js`.
