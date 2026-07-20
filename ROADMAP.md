# ROADMAP — Mundial 2026 v2

> Reflexión: si empezara este proyecto de cero hoy, o si tuviera que hacer una v2 para el Mundial 2030, qué cambiaría, qué sumaría, qué tiraría a la basura. No es un plan de ejecución, es un mapa mental para cuando llegue el momento.

**Audiencia:** vos (Marcelo) leyendo dentro de 2 años antes de empezar el próximo mundial.

---

## 1. Lecciones aprendidas del v1

Esto es lo que aprendimos construyendo y operando el v1. Algunas son técnicas, otras son de producto, otras son de proceso. Antes de hablar de qué construir nuevo, vale la pena saber qué funcionó y qué no.

### 1.1 Lo que funcionó bien

**SQLite con better-sqlite3.** Para 40 usuarios y unos cuantos miles de predicciones, SQLite vuela. Cero latencia de red, queries simples, backup = copiar un archivo. El PRAGMA WAL + busy_timeout dio concurrencia decente. Si el v2 es hobby y < 10K usuarios, SQLite sigue siendo válido. Si crece, Postgres.

**Vue 3 sin build (vía CDN).** Cero webpack, cero vite, cero node_modules del frontend. El `index.html` + `app.js` se sirven como estáticos y Vue corre global. Para una app de este tamaño funcionó perfecto: deploy = subir archivos. El costo es no tener type-checking, code splitting ni SSR. Para v2 depende de si vas a SSR la landing.

**Express + REST clásico.** 70 endpoints, sin GraphQL, sin tRPC. Simple, debuggeable, cacheable con headers HTTP estándar. Para una app CRUD como esta, REST es suficiente. No veo razón para meter GraphQL.

**Web Push + WhatsApp dual.** Push para usuarios activos, WhatsApp para mayor alcance. El push depende de que el usuario haya dado permiso y tenga el tab abierto, WhatsApp llega siempre. Tener ambos es defensivo.

**PWA con service worker v96.** Cache offline, installable en home screen, manifest con icono. Para el Mundial (evento concentrado en 1 mes) la PWA vale más que una app nativa.

**Deploy en cPanel con Node.js App.** Setup Node.js + PM2 + Apache proxy. Funciona, es barato ($0 extra de infra), y no requiere aprender Kubernetes. Para hobby, perfecto.

**Google OAuth (no email/password).** Cero passwords que almacenar, cero reset password flow, cero phishing surface. El usuario entra con su Google en 2 clicks. Para una app donde el usuario vuelve cada 4 años, esto es ideal: no recordás la password.

**Bracket con propagación automática.** Cuando marcás el ganador de un R32, el equipo aparece en el slot del R16. State machine implícito via `propagateWinner`. Funcionó.

### 1.2 Lo que costó / fue frágil

**Admin.js monolítico (1105 LOC).** Un solo componente Vue con 5 tabs y todo el CRUD inline. Cada vez que tocás algo hay riesgo de romper otra cosa. Modularizar: un componente por tab, lógica compartida en composables.

**Bracket con placeholders 1°/2°/3° resueltos on-the-fly.** Funcionó pero el código en `bracket-flow.js` es opaco. La próxima vez, modelar bracket_matches con un campo `slot_type` explícito (winner_of / loser_of / 1st_group_a / etc) y un resolver puro.

**Reminders con setInterval 60s.** Funciona en single-process, pero si escalás a múltiples instancias cada una manda el reminder. Necesita lock distribuido o cron real.

**WhatsApp API externa frágil.** Depende del proveedor (en este caso `process.env.WHATSAPP_*`). Si el proveedor cambia formato o se cae, todo el flujo se rompe. Tener fallback o un adapter interface.

**JWT 30 días.** Para una app donde el usuario vuelve cada 4 años, perfecto. Pero para una sesión normal es largo. Si en v2 hay actividad diaria (chat, comentarios), bajar a 7 días + refresh token.

**Migrations inline idempotentes en `db.js`.** Cada `CREATE TABLE IF NOT EXISTS` está hardcodeado. Funciona al inicio, pero cuando la app crece y hay 30 migraciones, se vuelve spaghetti. Usar un tool real (Prisma Migrate, Drizzle Kit, Knex).

**Push notifications requieren HTTPS + re-engagement.** El usuario acepta el push el día 1, después lo desactiva, o nunca lo activa. WhatsApp llegó más. El push es nice-to-have, WhatsApp es el canal principal.

**No hay tests.** Cero. Ni unit, ni integration, ni e2e. Cada cambio es a mano. Esto es lo primero que pagás en v2.

**No hay CI.** No hay chequeo de que el código compile, que pase lint, que los tipos estén bien. Cada commit es a ciegas.

**No hay monitoring.** Si el server se cae a las 3am un día de partido, te enterás cuando un usuario te avisa. Inaceptable.

**Falta de audit log.** El admin puede cambiar resultados, pero no hay registro de qué cambió, cuándo, desde qué IP. Si hay disputa, no hay forma de saber.

### 1.3 Lo que se podría haber hecho antes

- Planear el schema de bracket el día 1, no el día 90.
- Modularizar Admin desde el inicio (es el componente que más crece).
- Tests desde el día 1, aunque sean smoke tests.
- Deploy pipeline desde el día 1 (no FTP manual).
- Backup automático desde el día 1 (no manual "me acuerdo de bajarlo").

---

## 2. Stack alternativo para v2

El v1 es Vue 3 + Express + SQLite + cPanel. Si tuviera que elegir el stack desde cero en 2026, hay 3 caminos realistas. No hay respuesta única, depende de qué priorizás.

### 2.1 Opción A: Next.js 14 (App Router) + Postgres + Prisma + NextAuth

**El pragmatismo.**

- **Next.js 14 con App Router**: full-stack TypeScript, server components para landing pública, server actions para mutations, file-based routing. SSR gratis para la landing (SEO si alguna vez lo necesitás), static export para el admin si querés.
- **Postgres** (Supabase, Neon, o Railway): multi-tenant ready, JSON columns, full-text search, RLS si usás Supabase. Migración natural desde SQLite.
- **Prisma**: migrations versionadas, type-safe queries, schema declarativo. Studio incluido para ver datos. Ecosistema enorme.
- **NextAuth.js v5**: Google OAuth + email magic link + credentials, todo built-in. Sessions en DB o JWT, configurable.
- **TanStack Query** para client state del lado del cliente (cache, optimistic updates, refetch).
- **shadcn/ui + Tailwind**: componentes copy-paste, no librería pesada. Temas dark/light triviales.
- **Deploy: Vercel** (gratis hobby) o self-host en Node.js con PM2.

**Pros:** ecosistema más grande del mundo JS, contratación fácil si algún día sumás devs, todo en un solo repo, deploy trivial.

**Contras:** Next.js cambia mucho entre versiones (13→14→15 son mental models distintos), bundle size grande si no cuidás, vendor lock-in parcial con Vercel (aunque self-host es posible).

**Cuándo elegirlo:** si la app va a tener > 1K usuarios activos, si querés SSR para la landing, si vas a contratar devs en el futuro, si querés type-safety end-to-end.

### 2.2 Opción B: SvelteKit + Postgres + Drizzle + Lucia

**La simplicidad moderna.**

- **SvelteKit**: web fundamentals, nested routes, server actions nativas, SSR built-in. Bundle final más chico que Next, DX más simple.
- **Drizzle ORM**: SQL-like, type-safe, migraciones con drizzle-kit, mejor performance que Prisma. Más liviano.
- **Lucia auth**: tipo de auth moderna (sessions, no JWT por defecto), Google OAuth + magic link, escrito en TS.
- **Tailwind + shadcn-svelte**.
- **Deploy: Vercel, Cloudflare Pages, o Node.js adapter.**

**Pros:** Svelte es genuinamente más simple que React/Vue. Drizzle es más rápido que Prisma. Bundle chico. Buenas defaults.

**Contras:** comunidad más chica que Next, menos ofertas de empleo si contratás, ecosistema de componentes más limitado.

**Cuándo elegirlo:** si priorizás DX simple, si no vas a contratar devs pronto, si querés bundle chico.

### 2.3 Opción C: Astro + React islands + Postgres

**El hibrido para contenido + islands.**

- **Astro**: SSG por default, React solo donde se necesita interactividad. Ideal si la landing pública es el foco.
- **React islands**: para los componentes interactivos (predictions, bracket, ranking).
- **Postgres + Drizzle**.
- **Auth.js o Lucia**.

**Pros:** performance brutal (la landing es HTML estático), SEO perfecto, bundle mínimo en el cliente, contenido (reglas, FAQ, posts) gratis.

**Contras:** si la app es 80% interactiva (como una polla), no ganás mucho. Astro brilla cuando la mayoría es contenido.

**Cuándo elegirlo:** si vas a tener un blog, landing pages por SEO, FAQ extenso, y la app es la minoría del sitio.

### 2.4 Mi recomendación

**Next.js 14 + Postgres + Prisma + NextAuth + Tailwind/shadcn** es la elección más segura y con mejor retorno de inversión para una polla mundialista hobby. Razón: ecosistema, type-safety, deploy trivial, escalabilidad si crece.

Si te copa Svelte, **SvelteKit + Drizzle + Lucia** es excelente y más simple. Más riesgo de comunidad chica, pero para hobby personal es indistinto.

Astro no lo recomendaría salvo que la landing/contenido sea central.

### 2.5 Lo que NO recomiendo

- **Remix**: comunidad chica, momentum decreciente, mejor quedarse con Next o SvelteKit.
- **tRPC**: interesante pero suma complejidad. Para una app hobby no vale.
- **NestJS**: overkill para hobby. Buena para empresas con 20 devs.
- **Microservicios**: nunca para una app de este tamaño. Un monolito modular es 10x más simple.
- **GraphQL**: no aporta sobre REST para este caso de uso.
- **Serverless con AWS Lambda**: cold starts en el primer request de un partido, debugging difícil.

---

## 3. Cambios arquitecturales para v2

Más allá del stack, hay cambios de diseño que harías knowing what you know now.

### 3.1 Monorepo estructurado

```
mundial2026/
├── apps/
│   ├── web/          # Next.js (o SvelteKit)
│   └── worker/       # Background jobs (BullMQ, reminders)
├── packages/
│   ├── db/           # Prisma schema + migrations
│   ├── types/        # Tipos compartidos API ↔ web
│   ├── ui/           # Componentes compartidos
│   └── config/       # tsconfig, eslint, prettier base
├── package.json
├── pnpm-workspace.yaml
└── turbo.json        # Turborepo para cache de builds
```

**Por qué:** aísla cada app, comparte tipos, build cache entre apps, un solo `pnpm install` para todo.

**Alternativa simple:** un solo repo con `/web` y `/api` adentro, sin monorepo formal. Para hobby alcanza.

### 3.2 TypeScript end-to-end

TODO en TypeScript. Frontend, backend, tipos compartidos, scripts. `tsconfig.strict: true`. Sin `any` salvo casos extremos.

**Por qué:** elimina una clase entera de bugs, refactor con confianza, autocomplete, documentación implícita. Una vez que lo tenés, no volvés atrás.

### 3.3 Migraciones versionadas

```bash
prisma migrate dev --name add_bracket_matches
prisma migrate deploy  # en producción
```

Cada cambio de schema es un archivo con timestamp. Rollback via `migrate resolve --rolled-back`. Deploy atómico. En CI, `prisma migrate deploy` antes de arrancar la app.

**Alternativa:** Drizzle Kit. Más liviano, similar concepto.

### 3.4 Autenticación con sessions + JWT dual

```typescript
// NextAuth con adapter Prisma
// Sessions en DB (no stateless)
// JWT solo para API calls externos (si los hubiera)
```

**Por qué:** revocable (podes forzar logout), auditable, refresh token real. Para hobby el v1 con JWT 30d está bien. Para v2 con multi-tenancy o suscripciones, sessions en DB.

### 3.5 Background jobs con BullMQ + Redis

Reemplaza el `setInterval(60_000)` del v1. BullMQ da:

- Jobs idempotentes
- Retry con backoff
- Dashboard web para ver jobs fallidos
- Cron jobs built-in (`queue.add('reminder', {}, { repeat: { pattern: '* * * * *' } })`)
- Múltiples workers (escala horizontal)

**Alternativa simple:** cron real del sistema operativo (`crontab`) o Vercel Cron si deployás ahí. Para hobby, cron real alcanza.

**Worker dedicado:** un proceso aparte (`apps/worker`) que solo corre jobs. La API no se bloquea.

### 3.6 Real-time con Server-Sent Events o WebSockets

Para el v1, el ranking se recarga con un botón o con un `watch` de Vue. Para v2, real-time con SSE:

```typescript
GET /api/rankings/stream
// Content-Type: text/event-stream
// data: { user: "Marcelo", points: 142, delta: +3 }
```

O con WebSockets (Pusher, Ably, o self-hosted con `ws`).

**Casos de uso:** ranking live durante un partido, "tu rival acaba de hacer X", chat por partido.

**Alternativa:** polling cada 30s con TanStack Query. Simple, suficiente para hobby.

### 3.7 File-based routing + layouts

Next.js App Router o SvelteKit lo dan gratis. Layouts anidados (ej: `/admin` con sidebar común, `/ranking` con header común) sin código custom.

### 3.8 Server components / loaders

Server components (Next) o loaders (SvelteKit) hacen fetch de datos en el server, sin waterfalls de API calls. El cliente recibe HTML pre-renderizado + JSON hidratado. Performance gratis.

### 3.9 Feature flags desde día 1

```typescript
import { flags } from '@/lib/flags'

if (flags.has('bracket.autoFill')) {
  await autoFillBracket()
}
```

Usa **GrowthBook** (open source) o **Unleash**. Permite:

- Rollout gradual
- A/B testing
- Kill switch instantáneo si algo se rompe
- Probar features en prod con subset de usuarios

Para hobby alcanza con un `.env` con boolean, pero si la app crece, real feature flags.

### 3.10 i18n desde el inicio

```typescript
// next-intl o svelte-i18n
const t = useTranslations('ranking')
t('title') // "Ranking" / "Standings" / etc
```

Soportar español, inglés, portugués. El Mundial tiene audiencia en los 3 idiomas. i18n retroactivo es un dolor; hacerlo desde el día 1 cuesta 10% más de esfuerzo y ahorra 80% de refactor.

---

## 4. Features nuevas para considerar

El v1 cubre el core (predictions, scoring, ranking, bracket). Estas son features que sumarían valor y que el v1 no tiene.

### 4.1 Multi-tenancy: ligas privadas

El modelo actual: una sola polla, todos los usuarios en la misma. Para v2:

```
polla:
  - oficial (todos)
  - familia-albís (10 usuarios)
  - oficina-maroto (25 usuarios)
  - amigos-universitarios (15 usuarios)
```

Cada usuario puede estar en N ligas. Cada liga tiene su propio ranking, sus propios settings, su propio campeón. Migración: el v1 se convierte en la liga "oficial".

**Complejidad:** media-alta. Cambia el schema (agregar `leagues` + `league_members`), cambia toda la API para filtrar por `league_id`, cambia la UI.

**Cuándo:** solo si la base de usuarios justifica. Para 40 usuarios en una sola liga, no vale. Para 500 usuarios en 20 ligas, sí.

### 4.2 Apuestas adicionales (mercado de predictions)

Más allá del resultado final:

- Primer gol
- Cantidad total de goles
- Goleador del partido
- ¿Habrá penalty?
- ¿Habrá roja?

Cada una con su peso en puntos. Scoring más rico, más engagement, más estrategia.

**Complejidad:** alta. Nuevo schema (`bet_types` + `user_bets`), nueva UI (form con N inputs), recalc engine extendido.

### 4.3 Chat / comentarios por partido

Thread de comentarios por partido. "¡Gol!", "Mirá esto", "El árbitro es un ladrón". Moderación básica (filtro de palabras, mute).

**Complejidad:** media. Schema simple (messages con match_id), UI con scroll infinito, rate limit, moderación.

**Alternativa:** no implementar chat, dejar que los usuarios compartan screenshots de WhatsApp. Para hobby, no vale.

### 4.4 Reacciones en vivo durante el partido

Botones de "🎉 Gol", "😱 Casi", "💤 Aburrido" mientras se juega. Conteos agregados en vivo. Engagement pasivo, no requiere escribir.

**Complejidad:** baja. WebSocket opcional (polling alcanza), schema simple, UI con botones grandes.

### 4.5 Sistema de trofeos / achievements

- "Nostradamus": 10 predicciones exactas
- "Loco": acertar 5 signos consecutivos
- "Soñador": predecir campeón que no clasifica
- "El contador": 100 predicciones hechas
- "Veterano": 4 mundiales jugados

Badge en el perfil, galería de trofeos, optional sharing.

**Complejidad:** baja. Schema (`achievements` + `user_achievements`), reglas en código, UI con grid de iconos.

### 4.6 Histórico de mundiales

Track record del usuario en Mundiales 2014, 2018, 2022, 2026. Posición global, total de puntos, mejor predicción, peor predicción. "El día que acertaste el 7-1".

**Complejidad:** media. Datos históricos de mundiales pasados hay que cargarlos a mano (FIFA / Wikipedia). Schema (`world_cups` + `historical_predictions`).

### 4.7 Widget embebible

```html
<iframe src="https://mundial.i-logic.net/widget/league/abc" />
```

Ranking en vivo embebido en un blog o web de amigos. Genera backlinks, viralidad pasiva.

**Complejidad:** baja. Una vista nueva, sin auth, sin acciones.

### 4.8 App nativa (React Native / Expo)

Push notifications nativas (más confiables que web push), camera access (subir foto de perfil), biometric login, app store presence.

**Complejidad:** alta. Repo nuevo, dos apps (iOS + Android), App Store review, mantenimiento doble.

**Cuándo:** si la base de usuarios activos pasa de 1K y la web PWA se queda corta. Para hobby, overkill.

### 4.9 2FA para admins

TOTP (Google Authenticator / Authy). Capa extra sobre Google OAuth. Si el Google account del admin se compromete, el atacante no entra al admin.

**Complejidad:** baja-media. Librería `otplib`, schema (`user_2fa`), UI de setup, enforce en `adminRequired` middleware.

### 4.10 Audit log

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT,        -- 'match.update', 'prediction.override', 'user.delete'
  entity_type TEXT,   -- 'match', 'prediction', 'user'
  entity_id INTEGER,
  changes JSON,       -- { before: {...}, after: {...} }
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Cualquier acción admin queda registrada. Queryable, exportable, con retención.

**Complejidad:** baja (schema + middleware que escribe en cada acción admin). Valor altísimo para debugging y disputas.

### 4.11 Modo claro/oscuro

Toggle, persistencia en localStorage + cookie, CSS variables, transición suave. No-brainer para v2.

**Complejidad:** trivial con Tailwind + `dark:` prefix.

### 4.12 2FA TOTP + recovery codes

Setup genera 10 recovery codes one-time. Si perdés el device, entrás con un recovery code. Es el patrón de GitHub/GitLab.

### 4.13 E2E encryption de mensajes privados

Si se agrega chat entre usuarios (no por partido sino DM), los mensajes van cifrados con libsodium o similar. Nadie lee, ni el server.

**Cuándo:** solo si hay chat privado. Para una polla hobby, innecesario.

### 4.14 Modo espectador

Ver la polla de amigos sin participar. Útil si tu cuñado está en la polla y querés seguir su ranking sin entrar a competir.

### 4.15 Sincronización con FIFA data API

Si existe una API oficial de FIFA (no la conozco, pero Opendata o sportradar) que dé resultados en tiempo real, conectar y auto-update de scores. Elimina el paso manual de admin cargando resultados.

**Complejidad:** depende de la API. Si hay, baja. Si no, hay que armar scraping.

### 4.16 Modo "torneo completo" (no solo mundial)

Generalizar la plataforma para cualquier torneo: Champions League, Copa América, Premier League. Schema con `tournaments` parametrizable.

**Cuándo:** si la audiencia pide otros torneos. Para v2 hobby, scope creep, no hacer.

---

## 5. Infraestructura y DevOps

El v1 tiene deploy manual, sin CI, sin monitoring, sin backups automáticos. Esto es lo mínimo que v2 debería tener desde el día 1.

### 5.1 CI con GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build
```

Lint, type-check, test, build. Bloquea merge si falla. Corre en < 5 min.

### 5.2 Tests desde el día 1

- **Unit (Vitest)**: funciones puras, scoring engine, validaciones.
- **Integration (Vitest + test DB)**: endpoints API con DB de test (Postgres en Docker, schema seeded).
- **E2E (Playwright)**: flujo crítico (login → prediction → ranking update).

Coverage 80%+ en domain logic (scoring, bracket propagation, migrations). UI no necesita 100% coverage.

### 5.3 Deploy automático

- **Vercel**: git push a main → deploy automático, preview deployments para PRs.
- **Railway / Fly.io**: alternativa si querés Postgres incluido.
- **Self-host con PM2 + git pull + pm2 reload**: opción más barata, deploy con un script bash.

**Estrategia de deploy:** staging branch → staging URL → smoke test → merge a main → prod.

### 5.4 Backups automáticos

- **Postgres managed**: el provider hace backups automáticos (Neon, Supabase, Railway).
- **Si SQLite**: cron diario que copia el .db a S3 con retention de 30 días.
- **Restore drill**: cada 3 meses, restaurar el backup en un ambiente de test y verificar que funciona. Si nunca probaste restaurar, no tenés backup.

### 5.5 Monitoring y observabilidad

- **Sentry** (error tracking): free tier alcanza para hobby. Captura exceptions con stack trace, contexto del usuario, breadcrumbs.
- **Plausible / Umami** (analytics): privacidad-friendly, cookie-less. Te dice páginas más vistas, eventos custom.
- **UptimeRobot** (uptime monitoring): check cada 5 min, te avisa por email/WhatsApp si el server se cae.
- **Logflare / Better Stack** (logs centralizados): si tenés múltiples instancias, logs agregados con search.
- **OpenTelemetry** (tracing distribuido): si la app crece a múltiples servicios, tracing de requests end-to-end.

**Mínimo aceptable para hobby:** Sentry + UptimeRobot. Costo: $0.

### 5.6 Staging environment

Un ambiente separado donde probás cambios antes de prod. URL distinta, DB separada, datos sintéticos o anonimizados.

**Opciones:**
- Vercel preview deployments (gratis, automático en cada PR).
- Fly.io / Railway con `staging` branch.
- Self-host con `pm2 start --env staging`.

**Costo:** bajo si usás Vercel preview. Alto si self-host (segundo server).

### 5.7 CDN y assets

- **Vercel/Cloudflare**: CDN global gratis, cache de assets, image optimization.
- **Imágenes en `next/image` o `svelte-img`**: WebP automático, srcset, lazy load.
- **Fonts**: self-host con `next/font` (no Google Fonts CDN, GDPR + perf).

### 5.8 Secret management

- **Vercel env vars**: UI para secrets, separados por environment.
- **AWS Secrets Manager / Doppler**: si self-host, central secret store.
- **Nunca en .env en el repo**. `.env.example` con placeholders, `.env` en `.gitignore`.
- **Rotación periódica** de JWT_SECRET, VAPID keys, WhatsApp tokens.

### 5.9 Documentación

- **`README.md`**: stack, quick start, deploy, troubleshooting.
- **`docs/ARCHITECTURE.md`**: decisiones de diseño, schema, data flow.
- **`docs/API.md`**: autogenerado desde OpenAPI spec (o comentarios en código).
- **`docs/ROADMAP.md`**: este archivo.
- **`CHANGELOG.md`**: por release, qué cambió.
- **Inline comments**: solo en código no-obvio. El código se lee solo.

### 5.10 Estructura de branches

- **`main`**: producción, siempre deployable.
- **`feature/*`**: features en desarrollo.
- **`fix/*`**: bugfixes.
- **PR con review**: aunque seas solo vos, hacer PR a main fuerza CI + te obliga a releer el código.

---

## 6. Esquema de datos (ideas para v2)

El schema v1 es funcional. Para v2, algunas mejoras.

### 6.1 Multi-tenancy (si se hace)

```sql
CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE league_members (
  league_id INTEGER REFERENCES leagues(id),
  user_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (league_id, user_id)
);

-- Agregar league_id a:
-- matches, predictions, champion_picks, bracket_matches
```

Cada query filtra por `league_id`. RLS en Postgres simplifica enforcement.

### 6.2 Soft delete

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE matches ADD COLUMN deleted_at TIMESTAMP;
-- etc
```

En vez de `DELETE FROM`, hacer `UPDATE SET deleted_at = NOW()`. Query: `WHERE deleted_at IS NULL`. Permite undo, audit, GDPR right-to-be-forgotten después.

### 6.3 Audit log (mencionado arriba)

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,        -- 'match.update', 'user.delete'
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

### 6.4 Sessions table (si migra de JWT a sessions)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- session token
  user_id INTEGER REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
```

### 6.5 Notifications / activity feed

```sql
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,            -- 'match_result', 'ranking_change', 'mention'
  payload JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Para el in-app inbox (más allá de push/WhatsApp).

### 6.6 Predictions más ricas (si se hace el feature 4.2)

```sql
CREATE TABLE bet_types (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,              -- 'first_goal', 'total_goals', 'red_card'
  name TEXT,
  points INTEGER DEFAULT 1
);

CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  match_id INTEGER,
  bet_type_id INTEGER REFERENCES bet_types(id),
  prediction JSONB,              -- flexible
  points INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Flexible, soporta cualquier tipo de apuesta sin migration.

---

## 7. Proceso de desarrollo

### 7.1 TDD (Test-Driven Development)

Para domain logic crítico (scoring engine, bracket propagation, migrations), escribir el test primero, después el código. Para UI, no vale la pena.

### 7.2 Code review personal

Aunque seas solo vos, hacer PR a main con tu propio diff te obliga a releer. Encontrás bugs que se te pasaron escribiendo.

### 7.3 Convention over configuration

- **ESLint + Prettier** con config compartida.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`. Permite auto-generar CHANGELOG.
- **Husky + lint-staged**: pre-commit hook corre lint + format en archivos staged.

### 7.4 ADR (Architecture Decision Records)

Para cada decisión arquitectural importante, un ADR:

```markdown
# ADR-001: Next.js vs SvelteKit

## Context
Elegir framework full-stack para v2.

## Decision
Next.js 14 App Router.

## Consequences
+ Ecosistema grande, mejor contratación, deploy trivial.
- Bundle grande, breaking changes entre versiones.

## Alternatives considered
- SvelteKit: más simple, comunidad chica.
- Astro: overkill para app interactiva.
```

Guarda en `docs/adr/`. Cuando dentro de 2 años te preguntes "¿por qué elegí Next?", lo leés.

### 7.5 Time-boxing

Para hobby, lo más peligroso es el scope creep. Regla:

- **MVP de v2 = mismo feature set que v1, con el nuevo stack + tests + CI.**
- Todo lo de la sección 4 es **post-MVP**.

No caigas en "ya que estoy rehago, agrego multi-tenancy, chat, achievements, ...". Primero el núcleo, después iterar.

---

## 8. Estimación de esfuerzo

Tiempos aproximados para una persona, en horas, asumiendo experiencia con el stack.

### 8.1 MVP (rehacer v1 con nuevo stack)

| Tarea | Horas |
|-------|-------|
| Setup monorepo + tooling (Next, Prisma, NextAuth, Tailwind) | 8 |
| Schema + migrations (8 tablas) | 4 |
| Auth Google OAuth | 4 |
| CRUD matches + admin UI | 12 |
| Predictions + scoring engine + tests | 16 |
| Champion picks | 4 |
| Bracket system | 24 |
| Ranking + podium + race chart | 8 |
| Push + WhatsApp | 8 |
| Reminders job (BullMQ) | 4 |
| Backup/restore | 4 |
| PWA (manifest + sw) | 4 |
| Tests (unit + integration) | 24 |
| CI + deploy pipeline | 4 |
| Documentation | 8 |
| **Total MVP** | **~136 horas** |

A 10h/semana (sesiones largas de finde), ~14 semanas. 3-4 meses. Si le metés más horas, baja.

### 8.2 Features post-MVP

| Feature | Horas |
|---------|-------|
| Multi-tenancy (ligas privadas) | 40 |
| Apuestas adicionales | 32 |
| Chat por partido | 24 |
| Achievements | 12 |
| Histórico de mundiales | 16 |
| Widget embebible | 8 |
| App nativa (Expo) | 80 |
| Audit log | 8 |
| 2FA admin | 8 |
| Dark mode | 4 |
| i18n (3 idiomas) | 16 |

**Total post-MVP completo:** ~248 horas adicionales. Otro año hobby.

### 8.3 Decisión pragmática

No rehacer todo. En vez de eso, **v2 incremental**:

1. Mantener v1 corriendo para el Mundial 2026.
2. Empezar v2 con el core (MVP) apuntando al Mundial 2030.
3. Iterar features nuevas en v2 según demande la base de usuarios.
4. Migrar usuarios gradualmente si tiene sentido.

El v1 ya está deployed, funciona, y el Mundial 2026 está a la vuelta de la esquina. Rehacer desde cero es 3-4 meses que podrías usar agregando features al v1.

---

## 9. Cuándo NO rehacer

Rehacer un proyecto es tentador. "Haría todo mejor". Pero:

- **Si v1 funciona y resuelve el problema, no lo rehagas.** El costo de migración es alto, los bugs viejos vuelven, los usuarios se pierden.
- **Si el Mundial 2030 va a usar v1 sin problemas, dejalo.** Mejor invertir el tiempo en features nuevas dentro de v1.
- **Si solo querés aprender un stack nuevo**, hacelo en side projects chicos, no en el proyecto que ya funciona.
- **Rehacer solo si:** el v1 tiene un bug arquitectural que no se puede parchar, o si el Mundial 2030 necesita features que v1 no soporta por diseño (no por tiempo).

La regla es: **rehacer es la última opción, no la primera.**

---

## 10. Resumen ejecutivo

Si tuviera que darte 5 recomendaciones para un eventual v2:

1. **Stack pragmático: Next.js + Postgres + Prisma + NextAuth.** Ecosistema grande, deploy trivial, type-safe end-to-end. Si te copa Svelte, SvelteKit + Drizzle + Lucia es igual de bueno y más simple.

2. **Tests + CI desde el día 1.** El costo de no tenerlos en v1 se pagó con horas de debugging manual. Esta vez, no.

3. **Multi-tenancy (ligas privadas) es el feature de mayor impacto.** Convierte "una polla" en "plataforma de pollas". Pero es esfuerzo alto, hacer post-MVP.

4. **Monitoreo básico desde el día 1: Sentry + UptimeRobot.** Te enterás cuando algo se rompe, no cuando un usuario te avisa.

5. **No rehacer v1 todavía.** Invertir el tiempo en features nuevas del v1 actual, o esperar a que el Mundial 2030 esté cerca y ahí decidir.

El Mundial 2026 está vivo en v1. Dejarlo correr. Pensar en v2 cuando llegue el momento.

---

**Última actualización:** Julio 2026. Antes de empezar a rehacer, releer este doc y ver qué cambió (nuevos frameworks, nuevas prácticas, nuevas prioridades personales).
