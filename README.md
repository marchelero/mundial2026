# Mundial 2026 - Polla Mundialista

App web para gestionar una **polla (quiniela) del Mundial 2026**. Los usuarios registran sus pronósticos, se calculan puntos automáticamente y el admin exporta todo a CSV.

**Stack:** Vue 3 (CDN) + Express.js + SQLite + Google OAuth + JWT + PWA

---

## Tabla de contenidos

- [Desarrollo local (paso a paso)](#desarrollo-local-paso-a-paso)
- [Despliegue en cPanel](#despliegue-en-cpanel)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Sistema de puntos](#sistema-de-puntos)

---

## Desarrollo local (paso a paso)

### Requisitos

- **Node.js 18 o superior** — [descargar](https://nodejs.org/)
- **Git** — [descargar](https://git-scm.com/)
- Una cuenta de **Google** para crear el OAuth Client ID
- **Navegador moderno** (Chrome, Edge, Firefox)

### Paso 1: Clonar el repositorio

```bash
git clone <url-del-repositorio> mundial2026
cd mundial2026
```

### Paso 2: Instalar dependencias

```bash
npm install
```

Esto instala Express, better-sqlite3, jsonwebtoken, google-auth-library, helmet, compression, express-rate-limit, dotenv.

> **Posible error con `better-sqlite3`**: Si falla la compilación del módulo nativo en Windows, instalá primero `node-gyp`:
> ```bash
> npm install -g windows-build-tools
> ```
> O usá una versión precompilada: `npm install better-sqlite3 --build-from-source=false`.

### Paso 3: Crear el archivo `.env` (backend)

```bash
cp .env.example .env
```

Abrí `.env` con cualquier editor y completá los valores. El archivo se ve así:

```ini
# Backend API (modo desarrollo separado)
BACKEND_PORT=3001

# Frontend (modo desarrollo separado)
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:3001

# Puerto combinado (produccion)
PORT=3000

NODE_ENV=development
JWT_SECRET=aca-va-un-string-seguro-y-largo
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=tuemail@gmail.com
```

**Qué va en cada campo:**

| Variable | Explicación |
|---|---|
| `JWT_SECRET` | Secreto para firmar los tokens JWT. Generalo con: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `GOOGLE_CLIENT_ID` | El Client ID que vas a crear en Google Cloud Console (Paso 5). **Es el mismo valor que va en `frontend/public/config.js`** |
| `ADMIN_EMAILS` | Tu email de Google (el que usás para loguearte). Si son varios, separalos con coma: `admin1@gmail.com,admin2@gmail.com` |
| `NODE_ENV` | En desarrollo dejalo como `development`. En producción (cPanel) va `production` |
| `BACKEND_PORT` / `FRONTEND_PORT` | Puertos para desarrollo separado. **No tocar si no sabés lo que hacés** |

### Paso 4: Crear el archivo `config.js` (frontend)

```bash
cp frontend/public/config.example.js frontend/public/config.js
```

Abrí `frontend/public/config.js` y editá:

```js
var ADMIN_EMAILS = ['tuemail@gmail.com'];
var GOOGLE_CLIENT_ID = 'tu-client-id.apps.googleusercontent.com';
```

> **IMPORTANTE:** El `GOOGLE_CLIENT_ID` debe ser **exactamente el mismo** que pusiste en `.env`. Si no coinciden, el login falla.

### Paso 5: Crear el Client ID en Google Cloud Console

Este es el paso más importante. Seguí exactamente:

#### 5.1. Crear proyecto

1. Andá a [Google Cloud Console](https://console.cloud.google.com/)
2. Arriba a la izquierda, click en el selector de proyectos → **NUEVO PROYECTO**
3. Ponele un nombre como "Mundial 2026"
4. Click en **CREAR**
5. Esperá que se cree y seleccioná el proyecto

#### 5.2. Habilitar la pantalla de consentimiento

1. En el menú de la izquierda, andá a **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Seleccioná **Externo** (es la única opción si no tenés Workspace)
3. Click en **CREAR**
4. Completá:
   - **Nombre de la aplicación:** `Mundial 2026 Polla`
   - **Correo electrónico de soporte:** tu email
   - **Correo electrónico de contacto:** tu email
5. Click en **GUARDAR Y CONTINUAR** (en scopes y usuarios de prueba no toques nada, dejá por defecto)
6. Click en **VOLVER AL PANEL**

#### 5.3. Crear el Client ID

1. En el menú de la izquierda, andá a **APIs y servicios** → **Credenciales**
2. Click en **+ CREAR CREDENCIALES** → **ID de cliente de OAuth**
3. Tipo de aplicación: **Aplicación web**
4. **Nombre:** `Mundial 2026 Local`
5. En **Orígenes de JavaScript autorizados**, click en **AGREGAR URI** y agregá **UNO POR LÍNEA**:
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   ```
6. En **URIs de redireccionamiento autorizados**, NO AGREGUES NADA (no se necesita para este flujo)
7. Click en **CREAR**

#### 5.4. Copiar el Client ID

1. Aparece un modal con **Tu ID de cliente** y **Secreto del cliente**
2. Copiá solo el **ID de cliente** (es algo como `123456789-abc123.apps.googleusercontent.com`)
3. Pegálo en **dos archivos**:
   - **`.env`** → `GOOGLE_CLIENT_ID=<lo-que-copiaste>`
   - **`frontend/public/config.js`** → `var GOOGLE_CLIENT_ID = '<lo-que-copiaste>';`
4. Click en **OK** para cerrar el modal

#### 5.5. Publicar la app (opcional pero recomendado)

Si dejás la pantalla de consentimiento en "Testing", solo los usuarios que agregues como "testers" van a poder loguearse.

1. Andá a **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Click en **PUBLICAR APLICACIÓN** → **CONFIRMAR**
3. Esto permite que **cualquier usuario con cuenta de Google** pueda loguearse

### Paso 6: Iniciar la app

```bash
npm run dev
```

Esto arranca **dos servidores**:
- **Backend API** → `http://localhost:3001` (maneja la lógica y la base de datos)
- **Frontend SPA** → `http://localhost:3000` (proxea automáticamente `/api/*` al backend)

También podés arrancarlos por separado:
```bash
npm run backend   # solo backend en :3001
npm run frontend  # solo frontend en :3000
```

### Paso 7: Probar

1. Abrí `http://localhost:3000` en el navegador
2. Hacé click en el botón **Iniciar sesión con Google**
3. Elegí tu cuenta
4. Si todo funciona, ves la pantalla principal con las solapas **Votar**, **Historial**, **Posiciones**

### Solución de problemas (desarrollo)

| Problema | Causa y solución |
|---|---|
| El botón de Google no aparece | Abrí F12 → Console. Si dice "GOOGLE_CLIENT_ID no configurado", revisá `frontend/public/config.js`. Si dice "Google Identity Services no cargado", revisá tu internet o bloqueador de scripts |
| Después de elegir mi cuenta, redirige a `accounts.google.com/gsi/transform` y queda en blanco | El `GOOGLE_CLIENT_ID` no está autorizado para `http://localhost:3000`. Revisá el paso 5.3 (Orígenes de JavaScript autorizados). Si ya lo agregaste, esperá 2 minutos y refrescá con **Ctrl+Shift+R** |
| La página carga datos viejos | El service worker cacheó archivos viejos. Hacé **Ctrl+Shift+R** (recarga forzada) o andá a Aplicación → Service Workers y desregistralo |
| No veo la solapa Admin | Tu email no está en `ADMIN_EMAILS`. Revisá `.env` y `frontend/public/config.js` |
| Error en consola: `Failed to load resource: the server responded with a status of 502` | El backend no está corriendo. Ejecutá `npm run backend` en otra terminal |

---

## Despliegue en cPanel

### Requisitos en cPanel

- **Setup Node.js App** habilitado (la mayoría de hosts con cPanel lo tienen)
- **Node.js 18 o superior** (se selecciona al crear la app)
- **SSL/HTTPS** activo (el service worker y Google OAuth lo requieren)

### Paso 1: Subir archivos al servidor

Excluí **siempre** `node_modules/`, `data/`, `.env`, `frontend/public/config.js` (contienen secretos o se generan en el servidor).

```bash
# Subir por SCP
scp -r mundial2026/ usuario@tudominio.com:/home/usuario/

# O clonar directo en el servidor (si tenés SSH)
git clone <url-del-repo> /home/usuario/mundial2026
```

### Paso 2: Crear la app en cPanel (UI)

1. En cPanel, buscá y entrá a **Setup Node.js App**
2. Click en **Create Application**
3. Completá:
   - **Node.js version:** 18.x.x o superior
   - **Application mode:** Production
   - **Application root:** `/home/usuario/mundial2026`
   - **Application URL:** Elegí el dominio o subdominio (ej: `mundial.tudominio.com`)
   - **Application startup file:** `server.js`
4. Click en **Create**
5. **Anotá el puerto** que te asigna (ej: 3000). Lo vas a necesitar.

### Paso 3: Configurar variables de entorno

En el root de la app (`/home/usuario/mundial2026/`), creá el archivo `.env`:

```bash
PORT=3000                    # ← el puerto que te asignó cPanel
NODE_ENV=production
JWT_SECRET=<generalo-con-el-comando-de-abajo>
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=tuemail@gmail.com
```

Generá el `JWT_SECRET` (ejecutalo en tu PC local, no en cPanel):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Paso 4: Configurar el frontend

```bash
cp frontend/public/config.example.js frontend/public/config.js
```

Editá `frontend/public/config.js` con los **mismos valores** que en `.env`:

```js
var ADMIN_EMAILS = ['tuemail@gmail.com'];
var GOOGLE_CLIENT_ID = 'tu-client-id.apps.googleusercontent.com';
```

### Paso 5: Configurar Google OAuth para producción

**Este paso es obligatorio para que funcione en tu dominio.**

1. Andá a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Seleccioná el mismo proyecto que usaste para desarrollo
3. Entrá al Client ID que creaste
4. En **Orígenes de JavaScript autorizados**, **AGREGÁ** (además de los que ya tenés):
   ```
   https://tudominio.com
   https://www.tudominio.com
   ```
   (reemplazá `tudominio.com` con la URL exacta que usás en cPanel)
5. Click en **GUARDAR**

### Paso 6: Instalar dependencias

Desde la UI de cPanel:
1. En **Setup Node.js App**, buscá la app que creaste
2. Click en **Run NPM Install**

O por SSH:
```bash
cd /home/usuario/mundial2026
npm install --production
```

> Si `better-sqlite3` falla: pedile al soporte del hosting que active `gcc`/`g++`/`make`/`python3`, o cambiá a Node 18 LTS que tiene prebuilt binaries.

### Paso 7: Iniciar la app

1. En **Setup Node.js App**, click en **Start App** o **Restart**
2. Esperá unos segundos
3. Abrí `https://tudominio.com` (o el subdominio que elegiste)

### Paso 8: Verificar

- ✅ La página carga correctamente
- ✅ El botón de Google aparece y permite loguearse
- ✅ Si tu email está en `ADMIN_EMAILS`, ves la solapa Admin
- ✅ Podés crear partidos, cargar resultados y exportar CSV

---

## Estructura del proyecto

```
mundial2026/
├── server.js              ← Entry point (modo combinado para cPanel)
├── dev.js                 ← Inicia backend + frontend (modo desarrollo)
├── package.json
├── .env
├── .env.example
│
├── backend/               ← Código del servidor API
│   ├── server.js          ← Backend standalone (puerto 3001)
│   ├── db.js              ← SQLite: schema + inicialización
│   ├── middleware/
│   │   └── auth.js        ← JWT: authRequired + adminRequired
│   └── routes/
│       ├── auth.js        ← Google OAuth → JWT
│       ├── matches.js     ← CRUD partidos
│       ├── predictions.js ← CRUD pronósticos + rankings + export
│       ├── champion.js    ← Pronóstico campeón
│       └── settings.js    ← Configuración admin
│
├── frontend/              ← Código del frontend
│   ├── server.js          ← Frontend standalone (puerto 3000, proxy a backend)
│   └── public/            ← Archivos estáticos
│       ├── index.html     ← Punto de entrada SPA
│       ├── config.js      ← Config frontend (gitignored)
│       ├── config.example.js
│       ├── app.js         ← Vue 3 app principal
│       ├── style.css
│       ├── paises.js      ← 48 países + banderas emoji
│       ├── manifest.json  ← PWA manifest
│       ├── sw.js          ← Service Worker
│       ├── .htaccess      ← Reglas Apache (cPanel)
│       ├── assets/
│       ├── icons/
│       └── src/
│           ├── components/ ← Login, Layout, MatchList, Admin, Ranking, MyPredictions
│           ├── services/   ← api.js, auth.js, game.js
│           └── utils/      ← helpers.js (calcPoints, flagUrl, formatDate)
│
└── data/                  ← SQLite DB (se crea sola, gitignored)
```

---

## API Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/google` | No | Login con Google (recibe credential, devuelve JWT) |
| `GET` | `/api/auth/me` | JWT | Datos del usuario autenticado |
| `POST` | `/api/auth/refresh` | JWT | Refresca el JWT |
| `GET` | `/api/matches` | No | Lista todos los partidos |
| `POST` | `/api/matches` | JWT+Admin | Crea un partido |
| `PATCH` | `/api/matches/:id` | JWT+Admin | Actualiza un partido |
| `DELETE` | `/api/matches/:id` | JWT+Admin | Elimina un partido |
| `GET` | `/api/predictions?user=X` | JWT | Pronósticos de un usuario |
| `GET` | `/api/predictions/match/:id` | JWT | Pronósticos de un partido |
| `GET` | `/api/predictions/rankings` | JWT | Todos los pronósticos de partidos finalizados |
| `GET` | `/api/predictions/export` | JWT+Admin | Export completo |
| `POST` | `/api/predictions` | JWT | Crear pronóstico |
| `GET` | `/api/champion-picks` | JWT | Pronóstico del campeón (usuario actual) |
| `GET` | `/api/champion-picks/all` | JWT | Todos los pronósticos de campeón |
| `POST` | `/api/champion-picks` | JWT | Crear/actualizar pronóstico de campeón |
| `GET` | `/api/settings` | No | Lista settings |
| `POST` | `/api/settings` | JWT+Admin | Crear/actualizar setting |
| `GET` | `/api/health` | No | Health check |

---

## Sistema de puntos

| Situación | Puntos |
|---|---|
| Resultado exacto | 3 |
| Acierto de ganador/empate (no exacto) | 1 |
| Error | 0 |
| Comodín activado | ×2 |
| Campeón acertado | +5 |

El comodín se puede usar en **un solo partido** por usuario en todo el torneo. Si el partido con comodín da 3 puntos, el usuario recibe 6.

---

## Comandos útiles

```bash
# Desarrollo (backend :3001 + frontend :3000)
npm run dev

# Solo backend
npm run backend

# Solo frontend (con proxy a backend)
npm run frontend

# Producción (modo combinado, un solo proceso)
npm start

# Health check
npm test

# Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Backup de la base de datos
cp data/mundial2026.db data/backup_$(date +%Y%m%d).db
```
