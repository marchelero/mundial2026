# Mundial 2026 - Polla Mundialista

App web para gestionar una **polla (quiniela) del Mundial 2026**. Los usuarios registran sus pronósticos, se calculan puntos automáticamente y el admin exporta todo a CSV.

## Stack

- **Frontend:** Vue 3 (CDN) — SPA sin build step
- **Backend:** Express.js + SQLite (better-sqlite3)
- **Auth:** Google OAuth2 (Google Identity Services) + JWT
- **Seguridad:** Helmet, Rate Limiting, CORS configurado
- **Performance:** Compresión gzip, índices en BD
- **PWA:** Instalable en celular (manifest.json + service worker)

## Requisitos

- Node.js 18+
- cPanel con "Setup Node.js App" habilitado (para producción)

## Cómo levantar el proyecto

### 1. Clonar y entrar

```bash
git clone <repo> mundial2026
cd mundial2026
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```bash
PORT=3000
JWT_SECRET=un-string-aleatorio-largo-y-seguro
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=tu@email.com
```

### 4. Configurar emails de admin

```bash
cp public/config.example.js public/config.js
```

Editar `public/config.js`:

```js
var ADMIN_EMAILS = ['tu@email.com'];
var GOOGLE_CLIENT_ID = 'tu-client-id.apps.googleusercontent.com';
```

> Solo los usuarios con estos emails ven la solapa **Admin**.

### 5. Iniciar el servidor

```bash
npm run dev
```

Esto inicia el servidor en `http://localhost:3000`.

### 6. Configurar Google OAuth

En la consola de [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Crear proyecto → "Credentials" → "OAuth client ID"
2. Tipo: **Web application**
3. Authorized JavaScript origins: `http://localhost:3000` (y tu dominio de producción)
4. Copiar **Client ID** y pegarlo en `.env` y `public/config.js`

### 7. Usar la app

Abrir `http://localhost:3000/` e iniciar sesión con Google.

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

Subir todo excepto `node_modules/`, `data/`, `.env`:

- Por FTP/SCP: `scp -r mundial2026/ usuario@host:/ruta/`
- O clonar directamente: `git clone <repo> /ruta/mundial2026`

### 2. Configurar en cPanel

Ir a **Setup Node.js App** > **Create Application**:

- **Node version:** 18 o superior
- **Application mode:** Production
- **Application root:** `/ruta/mundial2026`
- **Application startup file:** `server.js`
- **Application URL:** tu-dominio.com (o subdominio)

### 3. Configurar variables

Crear `.env` en el root de la app:

```bash
PORT=3000
JWT_SECRET=genera-un-string-aleatorio-largo
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
ADMIN_EMAILS=admin1@email.com,admin2@email.com
```

Copiar `public/config.example.js` a `public/config.js` con los mismos valores.

### 4. Instalar dependencias

En cPanel, seleccionar la app creada y hacer clic en **Run NPM Install**.

O por SSH:

```bash
cd /ruta/mundial2026
npm install --production
```

### 5. Reiniciar la app

En cPanel, seleccionar la app y hacer clic en **Restart**.

### 6. Verificar

Abrir `https://tu-dominio.com` y verificar que funciona.

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

# Ver logs en cPanel
# Ir a Node.js App > ver logs de la app
```

## Características de seguridad

- **Helmet:** Headers HTTP seguros configurados
- **Rate Limiting:** 
  - 1000 requests/15min para API general
  - 20 requests/15min para autenticación
- **JWT:** Tokens con expiración de 7 días
- **Validación:** Todos los inputs se validan en backend
- **CORS:** Configurado para permitir solo dominios autorizados
- **Compresión:** gzip para mejor performance

## Notas

- La base de datos SQLite se crea automáticamente al arrancar
- No requiere configuración manual de tablas
- Los archivos estáticos se sirven desde `public/`
- El frontend es una SPA en Vue 3 sin build step
- Índices en la BD para queries rápidas
- Manejo robusto de errores en frontend y backend

## Posibles problemas

- **No se ve la solapa Admin** → verificar que el email en `config.js` y `.env` coincidan con el del login
- **Login de Google no funciona** → verificar que el Client ID sea correcto y que el dominio esté en "Authorized JavaScript origins"
- **Error 502 en cPanel** → verificar que el puerto en `.env` coincida con el configurado en cPanel
- **No arranca la app** → revisar logs en cPanel o ejecutar `node server.js` manualmente para ver errores
