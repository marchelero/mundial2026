# 🏆 Mundial 2026 — Polla Mundialista

App web para gestionar una **polla (quiniela) del Mundial 2026**. Los usuarios registran sus pronósticos, se calculan puntos automáticamente y el admin exporta todo a CSV para Google Sheets.

## Stack

- **Frontend:** Vue 3 (CDN) + PocketBase SDK — SPA sin build step
- **Backend/Database:** [PocketBase](https://pocketbase.io/) v0.39 — SQLite embebido, auth, API REST. **Un solo binario hace de backend + frontend**
- **Auth:** Google OAuth2 (login con Google)
- **PWA:** Instalable en celular (manifest.json + service worker)

## Requisitos

- Linux, macOS o WSL2
- **Node.js 18+** (solo para `setup.js`, opcional)
- `curl`, `unzip` (para descargar PocketBase)

## Comandos principales

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Inicia el servidor (PocketBase + frontend) |
| `node setup.js` | Crea colecciones + configura Google OAuth (todo desde `.env`) |
| `./pocketbase superuser upsert <email> <pass>` | Crea o resetea el admin de PocketBase |
| `npm run reset` | Borra la DB y vuelve a iniciar (fresh start) |

## Cómo levantar el proyecto

### 1. Clonar y entrar

```bash
git clone <repo> mundial2026
cd mundial2026
```

### 2. Configurar emails de admin

```bash
cp pb_public/config.example.js pb_public/config.js
```

Editar `pb_public/config.js` y poner los emails de los administradores:

```js
var ADMIN_EMAILS = ['tu@email.com', 'otro@email.com'];
```

> Solo los usuarios con estos emails ven la solapa **Admin**.

### 3. Iniciar el servidor

```bash
npm run dev
```

Esto corre `start.sh`, que descarga PocketBase automáticamente (si no existe) y lo inicia en `http://0.0.0.0:8090`. **PocketBase sirve tanto la API como el frontend** — no hay que levantar nada más.

### 4. Crear el admin de PocketBase

Podés hacerlo de dos formas:

**Opción A — Desde el navegador (primera vez):**
Abrir `http://localhost:8090/_/` — al no haber admin, PocketBase muestra un formulario para crear el **superuser admin**.

**Opción B — Desde la terminal (más rápido, con `.env`):**

```bash
# Con el servidor DETENIDO (ctrl+c), crear/resetear el admin:
./pocketbase superuser upsert marcheloalbis@gmail.com 12345678

# O usando las variables del .env directamente:
./pocketbase superuser upsert $(grep PB_ADMIN_EMAIL .env | cut -d= -f2) $(grep PB_ADMIN_PASS .env | cut -d= -f2)
```

> Si ya existía un admin con ese email, el comando `upsert` solo actualiza la contraseña. No rompe nada.
>
> **Importante:** el servidor debe estar detenido para usar este comando. Después volvé a iniciarlo con `npm run dev`.

### 5. Configurar Google OAuth

En la consola de [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Crear proyecto → "Credentials" → "OAuth client ID"
2. Tipo: **Web application**
3. Authorized redirect URIs: `http://localhost:8090/api/oauth2-redirect`
   - Si deployás en un dominio, agregá también `https://tudominio.com/api/oauth2-redirect`
4. Copiar **Client ID** y **Client Secret**

Luego tenés dos opciones:

**Opción A — Automático (recomendado):** Poner los valores en `.env`:
```bash
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```
Y al correr `node setup.js` se configura solo.

**Opción B — Manual:** Ir a `http://localhost:8090/_/` → **Settings** → **Auth providers** → **Google** → pegar Client ID y Secret.

### 6. Setup de colecciones

Con el servidor ya corriendo (`npm run dev`), crear las colecciones:

```bash
# Con .env configurado (recomendado):
cp .env.example .env
# editar .env con los valores correctos
node setup.js   # lee PB_ADMIN_EMAIL y PB_ADMIN_PASS del .env automáticamente

# O pasando email y contraseña manualmente:
node setup.js marcheloalbis@gmail.com 12345678
```

Esto crea las colecciones `matches`, `predictions`, `champion_picks` y `settings` en PocketBase.

### 7. Usar la app

Abrir `http://localhost:8090/` e iniciar sesión con Google. El admin ve la solapa **Admin** para gestionar partidos.

## Cómo se usa

### Usuario normal

1. **Login** con Google
2. **Pronóstico campeón** — elegir el campeón del mundial (+5 pts bonus)
3. **Votar** — ingresar resultados de cada partido
   - Se puede usar el **⭐ comodín** en 1 partido (duplica puntos)
   - Los pronósticos se guardan y **no se pueden editar**
4. **Compartir** — botón de WhatsApp con los pronósticos
5. **Posiciones** — tabla de puntajes actualizada automáticamente
6. **Historial** — partidos pasados con puntos y colores

### Admin

El admin además ve la solapa **Admin** donde puede:

1. **Agregar partidos** — selector con los 48 países clasificados, fecha, hora y ronda
2. **Cargar resultados** — ingresar scores reales (los puntos se calculan automágicamente)
3. **Campeón real** — marcar el campeón para el bonus
4. **Exportar CSV** — descargar todo en formato tabla para Google Sheets
5. **WhatsApp** — configurar número de grupo para compartir

### Sistema de puntos

| Situación | Puntos |
|-----------|--------|
| Resultado exacto | 3 |
| Acierto de ganador/empate | 1 |
| Error | 0 |
| Comodín (⭐) | ×2 |
| Campeón acertado | +5 |

## Exportación a CSV

### Exportar todo

Botón "Descargar CSV completo" → `mundial2026_completo.csv`

Formato: una fila por participante, columnas:
`Participante, Campeón, Comodín, M1_Argentina_L, M1_Brasil_V, M1_Argentina_R, M1_Brasil_R, M2_...`

- `_L` = predicción como local
- `_V` = predicción como visitante
- `_R` = resultado real

### Exportar por partido

Botón "CSV" en cada partido → `pronosticos_Argentina_vs_Brasil.csv`

## Archivos importantes

```
mundial2026/
├── .env.example          # Template de variables de entorno
├── .gitignore            # config.js y .env están excluidos
├── start.sh              # Inicia PocketBase
├── setup.js              # Crea colecciones en la DB
├── fix-voto-unico.sh     # Script para forzar voto único (si hace falta)
│
└── pb_public/            # Frontend SPA (servido por PocketBase)
    ├── config.js         # ⚠️ CONFIGURACIÓN REAL (gitignored) — emails de admin
    ├── config.example.js # Template para config.js
    ├── app.js            # Lógica Vue 3
    ├── index.html        # Template SPA
    ├── style.css         # Estilos mobile-first
    ├── paises.js         # Los 48 países clasificados
    ├── manifest.json     # PWA manifest
    └── sw.js             # Service Worker
```

## Tips

- **Red local:** La app se sirve en `0.0.0.0:8090`. Otros dispositivos en la misma red pueden acceder via `http://IP-DEL-SERVIDOR:8090`
- **PWA:** En Android, abrir la URL → menú → "Add to Home screen"
- **Voto único:** Configurado desde `setup.js` (`updateRule: null`). Si se necesita re-abrir, usar `fix-voto-unico.sh`
- **PocketBase Admin UI:** `http://localhost:8090/_/`

## Posibles problemas

- **No se ve la solapa Admin** → verificar que el email en `config.js` coincida con el del login de Google
- **"admin@example.com" por defecto** → `cp pb_public/config.example.js pb_public/config.js` y poner tus emails
- **Login de Google no funciona** → verificar OAuth redirect URI en Google Cloud Console
- **No puedo loguear en `/_/` con `invalid credentials`** → resetear el admin con `./pocketbase superuser upsert <email> <pass>` (servidor detenido)
- **Error al exportar CSV** → PocketBase debe estar corriendo
- **CORS errors** → PocketBase ya permite CORS por defecto

---

## Despliegue en producción

### Requisitos mínimos

| Requisito | Detalle |
|-----------|---------|
| **Servidor** | VPS o servidor con Linux (Ubuntu 22+, Debian 12+, etc.) — cualquier proveedor (Hetzner, DigitalOcean, AWS, Contabo, Oracle Cloud free tier, etc.) |
| **RAM** | 512 MB mínimo (PocketBase + SQLite consume muy poco) |
| **Disco** | 1 GB libre mínimo |
| **CPU** | 1 core es suficiente |
| **Dominio** | Recomendado (ej: `polla.midominio.com`) — apuntar con DNS tipo A a la IP del servidor |
| **Node.js 18+** | Solo necesario la primera vez para correr `setup.js` (después no se necesita) |
| **curl, unzip** | Para descargar PocketBase automáticamente |

> **No necesitas Docker, ni Nginx obligatoriamente, ni base de datos externa.** PocketBase es un solo binario que incluye todo.

### Opción 1: VPS (recomendado — lo más fácil y barato)

#### 1. Subir el proyecto al servidor

```bash
# Desde tu máquina local
scp -r mundial2026/ usuario@TU-IP:/home/usuario/mundial2026
```

O mejor, cloná el repo directamente en el servidor:

```bash
ssh usuario@TU-IP
git clone <repo> /home/usuario/mundial2026
cd mundial2026
```

#### 2. Configurar

```bash
cp .env.example .env
nano .env
```

Completar con los datos reales:
- `ADMIN_EMAILS` — emails que verán el panel admin
- `PB_ADMIN_EMAIL` / `PB_ADMIN_PASS` — credenciales del superuser
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth de Google (el redirect URI debe ser `https://tudominio.com/api/oauth2-redirect`)

#### 3. Iniciar manualmente (prueba)

```bash
npm run dev
```

Si todo funciona, abrir `https://tudominio.com:8090` (hay que abrir el puerto 8090 en el firewall).

#### 4. Dejarlo corriendo con systemd (producción)

Crear el servicio:

```bash
sudo nano /etc/systemd/system/mundial2026.service
```

```ini
[Unit]
Description=Mundial 2026 Polla
After=network.target

[Service]
Type=simple
User=usuario
WorkingDirectory=/home/usuario/mundial2026
ExecStart=/home/usuario/mundial2026/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5
EnvironmentFile=/home/usuario/mundial2026/.env

[Install]
WantedBy=multi-user.target
```

Habilitar y arrancar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mundial2026
sudo systemctl start mundial2026
sudo systemctl status mundial2026
```

#### 5. Nginx como reverse proxy (para dominio + HTTPS)

Instalar Nginx y Certbot:

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

Configurar Nginx:

```bash
sudo nano /etc/nginx/sites-available/mundial2026
```

```nginx
server {
    listen 80;
    server_name tudominio.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/mundial2026 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Obtener SSL gratuito con Let's Encrypt:

```bash
sudo certbot --nginx -d tudominio.com
```

Certbot renueva el certificado automáticamente.

#### 6. Setup inicial (una sola vez)

Con el servidor corriendo:

```bash
node setup.js
```

Esto crea las colecciones en la base de datos.

#### 7. Abrir puertos en el firewall

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

> El puerto 8090 **no** necesita estar abierto si usás Nginx como reverse proxy.

---

### Opción 2: Shared hosting / cPanel (limitado)

PocketBase necesita ejecutar un binario, así que **la mayoría de shared hosting NO lo soporta**. Solo funciona si tu hosting ofrece:
- Acceso SSH
- Posibilidad de ejecutar procesos persistentes (Node.js apps, custom binaries)

Proveedores como **Hostinger (plan business+)**, **A2 Hosting**, o **Railway/Render** pueden funcionar.

Si tu hosting lo permite:
1. Subir los archivos por FTP/SSH
2. Correr `./pocketbase serve --http=0.0.0.0:8090`
3. Configurar un proxy en `.htaccess` o en la config del hosting para apuntar al puerto 8090

---

### Opción 3: Servicios gratuitos / baratos

| Servicio | Costo | Notas |
|----------|-------|-------|
| **Oracle Cloud Free Tier** | Gratis | VPS ARM con 1 GB RAM — perfecto para PocketBase |
| **Hetzner** | ~4€/mes | VPS en Europa, excelente performance |
| **Railway** | ~5€/mes | Deploy fácil, pero hay que configurar volumes para `pb_data` |
| **Fly.io** | Gratis (limitado) | Necesita configurar un volume persistente para SQLite |

---

### Backups

La base de datos es un solo archivo SQLite. Para hacer backup solo hay que copiar:

```bash
cp pb_data/pb_data.db /ruta/backup/pb_data_$(date +%Y%m%d).db
```

Automatizar con cron:

```bash
crontab -e
# Backup diario a las 3 AM
0 3 * * * cp /home/usuario/mundial2026/pb_data/pb_data.db /home/usuario/backups/pb_data_$(date +\%Y\%m\%d).db
```

---

### Comandos útiles en producción

```bash
# Ver logs del servicio
sudo journalctl -u mundial2026 -f

# Reiniciar después de una actualización
sudo systemctl restart mundial2026

# Actualizar el código
cd /home/usuario/mundial2026
git pull
sudo systemctl restart mundial2026

# Verificar que está corriendo
curl http://127.0.0.1:8090/api/health
```

---

### Checklist para producción

- [ ] VPS con Linux configurado y acceso SSH
- [ ] Dominio apuntando a la IP del servidor (registro DNS tipo A)
- [ ] `.env` configurado con emails de admin y Google OAuth
- [ ] `pb_public/config.js` generado con los emails de admin
- [ ] Google OAuth redirect URI actualizada: `https://tudominio.com/api/oauth2-redirect`
- [ ] PocketBase corriendo como servicio systemd
- [ ] Nginx como reverse proxy con SSL (Let's Encrypt)
- [ ] Firewall configurado (solo puertos 22, 80, 443)
- [ ] Backup automático configurado con cron
- [ ] `setup.js` ejecutado (colecciones creadas)
