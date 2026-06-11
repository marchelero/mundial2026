# Despliegue en cPanel — Mundial 2026 Polla

> **Importante:** Este README es específico para desplegar la app en un hosting con **cPanel + "Setup Node.js App"**.
> Para desarrollo local, usá el `README.md` principal.

---

## Índice

1. [Requisitos del hosting](#1-requisitos-del-hosting)
2. [Preparar el proyecto](#2-preparar-el-proyecto)
3. [Subir archivos al servidor](#3-subir-archivos-al-servidor)
4. [Crear la app Node.js en cPanel](#4-crear-la-app-nodejs-en-cpanel)
5. [Configurar variables de entorno](#5-configurar-variables-de-entorno)
6. [Configurar el frontend](#6-configurar-el-frontend)
7. [Instalar dependencias](#7-instalar-dependencias)
8. [Configurar Google OAuth para producción](#8-configurar-google-oauth-para-producción)
9. [SSL / HTTPS](#9-ssl--https)
10. [Probar](#10-probar)
11. [Solución de problemas comunes](#11-solución-de-problemas-comunes)
12. [Backups](#12-backups)

---

## 1. Requisitos del hosting

Antes de empezar, verificá que tu plan de hosting tenga:

| Requisito | Cómo verificarlo |
|---|---|
| **Node.js App** | En cPanel, buscá el ícono "Setup Node.js App". Si no aparece, tu plan no lo soporta. |
| **Node.js 18+** | Al crear la app en cPanel, seleccioná la versión 18.x.x o superior. |
| **SSL activo** | Google OAuth y PWA requieren HTTPS. Activá Let's Encrypt desde cPanel. |
| **Compilador nativo** | `better-sqlite3` necesita compilarse. Pedí al hosting que active gcc/g++/make/python3 si `npm install` falla. |

---

## 2. Preparar el proyecto

En tu PC local, antes de subir nada:

### 2.1. Verificar que tenés todo

```bash
# Asegurate de que el proyecto esté en su última versión
git pull

# Verificá que los archivos clave existan
ls -la server.js package.json backend/ frontend/
```

### 2.2. Generar JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Copiá el resultado. Lo vas a necesitar en el paso 5.

### 2.3. Archivos que NO se suben

Estos archivos están en `.gitignore` y **no deben subirse al servidor**. Si usás git para el deploy, el `.gitignore` los excluye automáticamente:

- `node_modules/`
- `data/`
- `.env`
- `frontend/public/config.js`
- `.agents`
- `skills-lock.json`

---

## 3. Subir archivos al servidor

Tenés dos opciones:

### Opción A: Git clone (recomendada, si tenés SSH)

```bash
# Conectate por SSH a tu hosting
ssh usuario@tudominio.com

# Cloná el repositorio
git clone <url-del-repositorio> /home/usuario/mundial2026
cd /home/usuario/mundial2026
```

### Opción B: SCP / FTP

Subí todo **excepto** los archivos de la sección 2.3:

```bash
# Desde tu PC
scp -r . usuario@tudominio.com:/home/usuario/mundial2026/ \
  --exclude node_modules \
  --exclude data \
  --exclude .env \
  --exclude frontend/public/config.js \
  --exclude .git \
  --exclude .agents
```

O usá el **Administrador de Archivos** de cPanel para subir los archivos manualmente (sin comprimir, los JS se sirven directo).

---

## 4. Crear la app Node.js en cPanel

1. En cPanel, buscá y hacé click en **Setup Node.js App**

2. Click en **Create Application**

3. Completá el formulario:

   | Campo | Valor |
   |---|---|
   | **Node.js version** | 18.x.x (o superior, la más reciente disponible) |
   | **Application mode** | `Production` |
   | **Application root** | `/home/usuario/mundial2026` |
   | **Application URL** | Elegí el dominio o subdominio (ej: `mundial.tudominio.com` o `tudominio.com/mundial2026`) |
   | **Application startup file** | `server.js` |
   | **Passenger log file** | Dejalo vacío (se genera solo) |
   | **Environment variables** | No las configures acá, se manejan con `.env` |

4. Click en **Create**

5. **Importante:** Anotá el **Application URL** y el **puerto asignado** que aparecen después de crear la app. El puerto suele ser algo como `30700` o similar. Lo vas a necesitar en el `.env`.

---

## 5. Configurar variables de entorno

Conectate por SSH al servidor o usá el **Administrador de Archivos** de cPanel para crear/editar el archivo `.env` en el **root de la app** (`/home/usuario/mundial2026/.env`):

```bash
cd /home/usuario/mundial2026
nano .env   # o el editor que prefieras
```

Contenido del archivo:

```ini
# ============================================
# cPanel: el puerto que te asignó cPanel
# ============================================
PORT=30700

NODE_ENV=production

# Generalo con: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=3Tq7wum0nH1vP8J19e/LFatXM6lZs/FqQ8rJih7QRmZEALLtyes7HyE3vY0BNw82

# El MISMO que está en Google Cloud Console y en frontend/public/config.js
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com

# Tu email con el que te logueás (sin espacios, en minúsculas)
ADMIN_EMAILS=tuemail@gmail.com
```

> **⚠️ No copíes los valores de ejemplo.** Reemplazalos con los tuyos.

**Dónde conseguir cada valor:**

| Variable | Dónde obtenerlo |
|---|---|
| `PORT` | El puerto que cPanel asignó al crear la app (paso 4) |
| `JWT_SECRET` | Generalo en tu PC con el comando de la sección 2.2 |
| `GOOGLE_CLIENT_ID` | Lo creaste en Google Cloud Console. Si no lo tenés, andá al paso 8 primero. |
| `ADMIN_EMAILS` | Tu email de Google (el mismo con el que te vas a loguear) |

---

## 6. Configurar el frontend

Creá el archivo `frontend/public/config.js` con los **mismos valores** que el `.env`:

```bash
cd /home/usuario/mundial2026
cp frontend/public/config.example.js frontend/public/config.js
nano frontend/public/config.js
```

Contenido:

```js
var ADMIN_EMAILS = ['tuemail@gmail.com'];
var GOOGLE_CLIENT_ID = '123456789-abc123.apps.googleusercontent.com';
```

> El `GOOGLE_CLIENT_ID` debe ser **exactamente el mismo** que está en `.env`. Si no coinciden, el login de Google falla.

---

## 7. Instalar dependencias

Tenés dos opciones:

### Opción A: Desde la UI de cPanel (recomendada)

1. En **Setup Node.js App**, buscá la app que creaste
2. Click en **Run NPM Install**
3. Esperá que termine (puede tardar 1-2 minutos)

### Opción B: Por SSH

```bash
cd /home/usuario/mundial2026
npm install --production
```

### Si `npm install` falla con `better-sqlite3`

```
gyp ERR! build error
```

Esto pasa cuando el hosting no tiene las herramientas para compilar módulos nativos. Posibles soluciones:

1. **Pedile al soporte del hosting** que active: `gcc`, `g++`, `make`, `python3`
2. **Cambiá la versión de Node.js** en cPanel: probá con 18.x LTS (tiene prebuilt binaries para better-sqlite3)
3. Como último recurso, reemplazá `better-sqlite3` por `sqlite3` (versión async, más lenta pero sin compilación):
   ```bash
   npm uninstall better-sqlite3
   npm install sqlite3
   ```
   Y editá `backend/db.js` para usar `sqlite3` en vez de `better-sqlite3`.

---

## 8. Configurar Google OAuth para producción

Si ya creaste el Client ID para desarrollo local (`http://localhost:3000`), **no crees otro**. Solo agregá tu dominio de producción a los orígenes autorizados.

### 8.1. Agregar el dominio

1. Andá a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials)
2. Hacé click en el **Client ID** que usás (el que tiene `localhost:3000`)
3. En **Orígenes de JavaScript autorizados**, agregá:
   ```
   https://tudominio.com
   https://www.tudominio.com
   ```
   Reemplazá `tudominio.com` con tu dominio real EXACTO (con `https://`, sin barra al final).
4. Click en **GUARDAR**
5. Esperá **2-5 minutos** a que Google propague el cambio

### 8.2. Publicar la app (usuarios de prueba)

Si tu pantalla de consentimiento está en modo "Testing", solo los emails que agregues como testers van a poder loguearse.

Para permitir que **cualquier usuario de Google** se loguee:

1. En Google Cloud Console, andá a **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Click en **PUBLICAR APLICACIÓN**
3. Click en **CONFIRMAR**

---

## 9. SSL / HTTPS

**El login con Google y el Service Worker no funcionan sin HTTPS.**

Si tu dominio no tiene SSL activo:

1. En cPanel, buscá **SSL/TLS** o **Let's Encrypt**
2. Activá el certificado SSL para tu dominio
3. Esperá que se emita (suele ser automático en minutos)
4. Verificá que `https://tudominio.com` cargue correctamente

> Si después de activar SSL ves errores mixtos (contenido HTTP y HTTPS), asegurate de que todos los recursos en `index.html` se carguen con URLs relativas (ej: `/style.css` en vez de `http://...`).

---

## 10. Probar

### 10.1. Iniciar la app

1. En **Setup Node.js App**, seleccioná la app
2. Click en **Start App** o **Restart** (si ya estaba corriendo)
3. Esperá unos segundos

### 10.2. Verificar el health check

```bash
# Desde SSH, o desde cualquier navegador
curl https://tudominio.com/api/health
```

Debería responder:
```json
{"status":"ok","timestamp":"2026-06-11T00:00:00.000Z"}
```

### 10.3. Verificar la página

1. Abrí `https://tudominio.com` en el navegador
2. Deberías ver la pantalla de login con el botón de Google
3. Hacé click en **Iniciar sesión con Google**
4. Elegí tu cuenta
5. Verificá que:
   - ✅ La página principal carga después del login
   - ✅ Las solapas Votar / Historial / Posiciones aparecen
   - ✅ Si tu email está en `ADMIN_EMAILS`, ves la solapa Admin

---

## 11. Solución de problemas comunes

### Error 502 Bad Gateway

**Causa:** El puerto en `.env` no coincide con el que cPanel asignó.

**Solución:** Revisá el puerto en **Setup Node.js App** y asegurate de que `PORT` en `.env` tenga ese mismo número.

### Login de Google no funciona (pantalla en blanco en `/gsi/transform`)

**Causa:** El dominio no está en "Authorized JavaScript origins" de Google Cloud Console.

**Solución:** Revisá el paso 8.1. La URL tiene que ser **exactamente igual** a la que ves en el navegador, incluyendo `https://` y sin barra al final.

### Login de Google funciona pero no veo Admin

**Causa:** Tu email no está en `ADMIN_EMAILS`.

**Solución:**
1. Revisá `.env` → `ADMIN_EMAILS=tuemail@gmail.com`
2. Revisá `frontend/public/config.js` → `var ADMIN_EMAILS = ['tuemail@gmail.com'];`
3. Ambos deben tener tu email exacto (minúsculas, sin espacios)

### No se ven las banderas de los países

**Solución:** Las banderas se cargan desde `https://flagcdn.com/`. Si tu hosting bloquea ese CDN o el sitio está forzado a HTTPS mixto, podés cambiar la fuente en `frontend/public/src/utils/helpers.js` en la función `flagUrl()`.

### La página se ve rara o muestra datos viejos

**Solución:** El Service Worker cacheó archivos viejos. En el navegador:
1. Abrí F12 → Application → Service Workers
2. Hacé click en **Unregister**
3. Refrescá con Ctrl+Shift+R

### Error de conexión a la base de datos

**Solución:** La carpeta `data/` se crea automáticamente al iniciar la app. Si el usuario del proceso Node no tiene permisos de escritura:

```bash
cd /home/usuario/mundial2026
mkdir -p data
chmod 755 data
chown usuario:usuario data
```

---

## 12. Backups

La base de datos es un archivo SQLite en `data/mundial2026.db`. Es **el único archivo que contiene datos de usuarios y pronósticos**.

### Backup manual

```bash
cp /home/usuario/mundial2026/data/mundial2026.db /home/usuario/backups/mundial2026_$(date +%Y%m%d).db
```

### Backup automático con cron

Si tu plan de cPanel permite crons (cron jobs):

```bash
0 3 * * * cp /home/usuario/mundial2026/data/mundial2026.db /home/usuario/backups/mundial2026_$(date +\%Y\%m\%d).db
```

> **Importante:** Copiá también los archivos `data/mundial2026.db-wal` y `data/mundial2026.db-shm` si existen (modo WAL). Sin ellos, el backup puede estar incompleto.

### Restaurar

```bash
# Detené la app desde cPanel
cp /home/usuario/backups/mundial2026_20260601.db /home/usuario/mundial2026/data/mundial2026.db
# Iniciá la app desde cPanel
```
