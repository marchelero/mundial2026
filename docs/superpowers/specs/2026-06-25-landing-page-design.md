# Landing Page Publica con Bar Race

**Fecha:** 2026-06-25
**Proyecto:** Mundial 2026 - Polla
**Status:** Aprobado en design (pendiente review del usuario)

## Contexto

La pantalla actual de la app para visitantes no logueados es `<Login />`: solo muestra el logo y el boton "Iniciar sesion con Google". Es un dead-end visual que no engancha ni comunica el valor de la polla.

La polla ya esta activa (40 partidos finalizados a la fecha, ~12 participantes). Hay data real para impresionar a un visitante nuevo. El componente `Ranking.js` ya implementa un bar race animado con echarts, pero solo accesible para usuarios logueados (los endpoints requieren JWT).

## Problemas a resolver

1. **Primera impresion pobre**: visitante ve solo logo + boton. No entiende que es una polla activa con participantes en competencia.
2. **Friccion de signup**: nada motiva a hacer login.
3. **Reutilizacion de data**: la app ya calcula rankings y bar race para usuarios logueados. Falta exponerlos publicamente.

## Solucion

Reemplazar la pantalla de login por una **landing publica** con:
- Hero con bar race animado (autoplay, todos los participantes)
- 3 stat cards (participantes | partidos | jugados)
- Preview top 5 del ranking
- Boton "Iniciar sesion con Google" sticky top
- Empty state si el torneo no empezo

Requiere **nuevo endpoint publico** (los existentes requieren JWT) que devuelva data minima para renderizar la landing sin exponer informacion sensible.

## Especificacion

### 1. Backend — nuevo endpoint publico

**Archivo nuevo:** `backend/routes/public.js`

**`GET /api/public/landing-data`**

- Sin autenticacion (no usa `authRequired`).
- Rate limited: 30 req / 5 min por IP (reusar `express-rate-limit` ya instalado en el proyecto).
- Response `200`:
  ```json
  {
    "stats": {
      "participantes": 12,
      "partidos": 104,
      "jugados": 40,
      "proximo": { "date": "2026-06-26", "time": "21:00", "home_team": "...", "away_team": "...", "home_flag": "🏠", "away_flag": "🚩" } | null
    },
    "rankings": [
      { "id": "u_abc", "name": "Juan", "points": 18, "comodines_usados": 0 }
    ],
    "finishedMatches": [
      { "id": "m_xyz", "date": "2026-06-12", "time": "15:00", "home_team": "...", "away_team": "...", "home_score": 2, "away_score": 1, "home_flag": "🏠", "away_flag": "🚩", "round": "Group A" }
    ],
    "predictions": [
      { "match_id": "m_xyz", "user_id": "u_abc", "home_score": 2, "away_score": 1, "points": 3, "comodin": false }
    ]
  }
  ```

**Query SQL (concepto, no literal final):**
- `stats.participantes`: `SELECT COUNT(*) FROM users`
- `stats.partidos`: `SELECT COUNT(*) FROM matches`
- `stats.jugados`: `SELECT COUNT(*) FROM matches WHERE status='finished'`
- `stats.proximo`: el proximo partido `status='open'` con `date+time >= nowStr()`, ORDER BY date, time LIMIT 1
- `rankings`: mismo query que `users.js:107-114` pero **sin email** y **sin potential_points** (no se filtra en landing publica, evita especulacion)
- `finishedMatches`: `SELECT id, date, time, home_team, away_team, home_score, away_score, round FROM matches WHERE status='finished' ORDER BY date ASC, time ASC`
- `predictions`: `SELECT match_id, user_id, home_score, away_score, points, comodin FROM predictions WHERE match_id IN (SELECT id FROM matches WHERE status='finished')`

**Privacy (importante):**
- **NO** incluir emails
- **NO** incluir champion picks
- **NO** incluir predictions de partidos no finalizados
- **NO** incluir potential_points (cambia seguido, no aporta a landing)
- Datos personales quedan solo detras de JWT

**Error handling:**
- `429` si supera rate limit
- `500` con mensaje generico si falla SQL (no leakear detalle)

**Montaje en `backend/server.js`:**
```js
const publicRouter = require('./routes/public');
app.use('/api/public', publicRouter);
```

### 2. Frontend — nuevo componente Landing

**Archivo nuevo:** `frontend/public/src/components/Landing.js`

Reemplaza `<Login v-if="!user" />` en `app.js:41` por:
```js
<Landing v-else-if="!user" :landing-data="landingData" :auth-error="authError" />
```

**Props:**
- `landingData`: object | null
- `authError`: string (reusado del flujo actual)

**State local:**
```js
data() {
  return { showAll: false, allUsers: [], topUsers: [] }
}
```

**Computed:**
```js
rankings() { return this.landingData?.rankings || [] },
stats() { return this.landingData?.stats || {} },
finishedMatches() { return this.landingData?.finishedMatches || [] },
predictions() { return this.landingData?.predictions || [] },
topUsers() { return this.rankings.slice(0, 10) },
allUsers() { return this.rankings },
raceUsers() { return this.showAll ? this.allUsers : this.topUsers },
hasData() { return this.stats.jugados > 0 }
```

**Estructura del template:**
```html
<div class="landing">
  <header class="landing-top">
    <img src="/assets/logo.png" class="landing-logo-small">
    <button v-if="!googleLoading" @click="triggerGoogleLogin" class="landing-login-btn">
      Iniciar sesion con Google
    </button>
  </header>

  <section class="landing-hero">
    <h1>POLLA MUNDIALISTA 2026</h1>
    <p class="landing-tagline">
      Ya somos {{ stats.participantes }} participantes.
      {{ stats.jugados }} de {{ stats.partidos }} partidos jugados.
      ¿Vas a entrar?
    </p>

    <div v-if="hasData" class="race-section">
      <div ref="raceContainer" class="race-container"></div>
      <button v-if="allUsers.length > 10" @click="showAll = !showAll" class="race-toggle-btn">
        {{ showAll ? `VER TOP 10` : `VER TODOS (${allUsers.length})` }}
      </button>
    </div>

    <div v-else class="race-empty">
      <h3>El torneo aún no empieza</h3>
      <p>El primer partido es el {{ stats.proximo?.date || 'próximamente' }}. ¡Inscribite y arrancá con ventaja!</p>
      <button @click="triggerGoogleLogin" class="landing-cta">Iniciar sesion con Google</button>
    </div>
  </section>

  <section class="landing-stats">
    <div class="stat-card">
      <div class="stat-value">{{ stats.participantes }}</div>
      <div class="stat-label">PARTICIPANTES</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{{ stats.partidos }}</div>
      <div class="stat-label">PARTIDOS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{{ stats.jugados }}</div>
      <div class="stat-label">JUGADOS</div>
    </div>
  </section>

  <section class="landing-top5" v-if="hasData">
    <h3>TOP 5 ACTUAL</h3>
    <ol class="top5-list">
      <li v-for="(r, i) in rankings.slice(0, 5)" :key="r.id">
        <span class="top5-pos">#{{ i + 1 }}</span>
        <span class="top5-name">{{ r.name }}</span>
        <span class="top5-pts">{{ r.points }} pts</span>
        <span v-for="n in r.comodines_usados" :key="n">🍀</span>
      </li>
    </ol>
  </section>

  <footer class="landing-footer">
    <small>© 2026 · Hecho con café y fútbol</small>
  </footer>
</div>
```

**Metodos clave:**

`renderRace()` — version parametrizada del `renderRace()` de `Ranking.js:188`:
- Input: `raceUsers` (top 10 o all)
- Construye `raceData` (timeline) cliente-side:
  ```js
  const yKey = {};
  for (const u of raceUsers) yKey[u.id] = 0;
  const raceData = finishedMatches.map(m => {
    const point = { date: m.date, label: m.date.split('-').slice(1).join('/') };
    for (const u of raceUsers) {
      const pred = predictions.find(p => p.match_id === m.id && p.user_id === u.id);
      const pts = pred?.points ?? 0;
      yKey[u.id] += pts;
      point[u.id] = yKey[u.id];
    }
    return point;
  });
  ```
- Misma logica de `makeOption()` + loop `setTimeout(step, 1500)` que `Ranking.js`.
- Altura del container: `raceUsers.length * 26 + 40`px (min 280, max 480 con scroll).

`triggerGoogleLogin()` — llama a `renderGoogleButton()` de `services/auth.js` o dispara el flujo equivalente (reusar lo que ya hace `Login.js`).

**Lifecycle:**
- `mounted()`: `this.$nextTick(() => this.hasData && this.renderRace())`
- `watch: { raceUsers: { handler() { dispose + re-render }, deep: true }`
- `unmounted()`: `if (this._chart) { this._chart.dispose(); this._chart = null }` + `clearTimeout(this.raceTimer)`

**Dark mode:** reusar `dark-mode-change` listener (mismo patron que `Ranking.js:298`).

### 3. Frontend — `app.js` cambios

```js
// import
import Landing from './src/components/Landing.js';

// components
components: { Login, Landing, Layout, ... }

// data: agregar
data() { return { ..., landingData: null, landingLoading: true, landingError: null } }

// template: reemplazar <Login v-if="!user" /> por:
<Landing v-else-if="!user" :landing-data="landingData" :auth-error="authError" />

// mounted: agregar carga
async mounted() {
  ...
  try {
    this.landingData = await api.get('/public/landing-data');
  } catch (e) {
    this.landingError = e.message;
  } finally {
    this.landingLoading = false;
  }
  ...
}
```

`Login.js` se mantiene (puede usarse como fallback si se quiere).

### 4. Frontend — `style.css` cambios

Agregar bloque `.landing-*` reusando variables CSS existentes (`--color-dark`, `--color-red`, `--color-gray`, `--font-brush`, etc).

Reglas clave:
- `.landing`: `min-height: 100vh; background: var(--color-bg);`
- `.landing-top`: `position: sticky; top: 0; display: flex; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); z-index: 10;`
- `.race-container`: `width: 100%; height: 280px;` (o dinamico via inline style)
- `.landing-stats`: `display: grid; grid-template-columns: 1fr; gap: 0.75rem;` mobile, `grid-template-columns: repeat(3, 1fr);` en `@media (min-width: 768px)`
- `.stat-card`: `text-align: center; padding: 1rem; background: var(--color-dark); color: white; border-radius: 8px;`
- Dark mode: selectores `data-dark-bg`, `data-dark-text` (mismo patron que ya usa `Ranking.js`)

### 5. Frontend — `sw.js` cambios

Bump `CACHE_NAME` (ej: `mundial-v2-landing` → `mundial-v3-landing`). Agregar `/src/components/Landing.js` al array `urlsToCache` si existe precache.

### 6. Auth flow

- Visitante entra a `/` → ve Landing
- Click "Iniciar sesion con Google" → google oauth (mismo flujo que Login.js actual)
- Login success → `event.detail` con user → `handleLoginSuccess(user)` → `view = 'votar'`, redirige a Layout
- Si ya logueado y entra a `/` → `view = 'votar'` directo, no ve Landing

## Decisiones

| # | decision | razon |
|---|---|---|
| 1 | Layout A (hero race + sticky login) | max hook, 1 pantalla principal |
| 2 | Endpoint `/api/public/landing-data` separado | privacy-by-default, una sola request, no rompe endpoints existentes |
| 3 | Autoplay loop infinito | "hook para nuevos", no requiere accion |
| 4 | Default top 10 + boton "VER TODOS" | legible por default, opcion de ver mas |
| 5 | N > 30 → scroll vertical | evita layout roto con muchos participantes |
| 6 | Sin email en response publica | privacidad, ranking.js original ya tiene email pero eso es para usuarios logueados |
| 7 | Sin champion picks ni predictions de no-finalizados | no aporta a la landing, reduce superficie de leak |
| 8 | Rate limit 30 req/5min | proteccion minima anti-scraping sin molestar usuarios reales |
| 9 | Reusar `renderRace()` patron de Ranking.js | consistencia visual, menos codigo nuevo |
| 10 | Empty state con CTA grande | si torneo no empezo, login reemplaza race |
| 11 | Login.js se mantiene | fallback, no rompe nada |

## Edge cases

- **0 participantes**: stats cards muestran 0, race no renderiza, top 5 vacio, mensaje "sé el primero".
- **0 jugados** (torneo no empezo): empty state, CTA login grande.
- **1 participante**: race muestra 1 barra animada, top 5 muestra 1 row.
- **40+ participantes, todos jugados**: race muestra top 10, boton "VER TODOS (40)", al click race crece con scroll.
- **Endpoint 429**: mensaje "demasiadas requests, recargá en un minuto" + boton retry.
- **Endpoint 500**: mensaje "no pudimos cargar el ranking ahora" + retry.
- **Sin internet**: mismo mensaje.
- **Race con 0 puntos en todos los frames**: si todos los picks fueron errados, el bar race muestra movimiento minimo. No es bug, refleja realidad.
- **Login success pero landing-data ya esta cargada**: ok, user se va a `/votar` directamente, no re-renderiza nada.
- **Dark mode activo**: race se re-renderiza con colores dark (mismo handler que Ranking.js).

## Testing

### Manual (pre-deploy)

- [ ] `npm run dev`, abrir `http://localhost:3000` sin loguearse → ve Landing
- [ ] Hero race visible, autoplay, ~12 barras animandose
- [ ] Hover sobre el race → tooltip con puntos
- [ ] Click "VER TODOS" (si hay >10) → race crece
- [ ] Click "VER TOP 10" → vuelve
- [ ] Stats cards muestran valores correctos
- [ ] Top 5 muestra los 5 mejores sin emails
- [ ] Click "Iniciar sesion con Google" → flow normal
- [ ] Logueado, abrir `/` → redirect a `/votar`, no ve Landing
- [ ] Empty state: `UPDATE matches SET status='open'` (simular no jugados) → ve mensaje + CTA grande
- [ ] Mobile (<768px): stats en columna, race container responsive
- [ ] Dark mode: race y stats se ven bien en ambos temas
- [ ] Spam refresh 30+ veces en 5 min → 429 visible

### Automatizado (opcional)

- E2E journey nuevo en `e2e-runner`: "visitante ve landing → click login → ve app"
- Unit test del endpoint publico: shape correcto, no leak de email ni champion picks
- Unit test del rate limit: req 31 → 429

## Archivos tocados

**Nuevos:**
- `backend/routes/public.js`
- `frontend/public/src/components/Landing.js`
- `docs/superpowers/specs/2026-06-25-landing-page-design.md` (este archivo)

**Modificados:**
- `backend/server.js` (1 linea: `app.use('/api/public', publicRouter)`)
- `frontend/public/app.js` (import Landing, cambiar template, agregar state + carga)
- `frontend/public/style.css` (agregar bloque `.landing-*`)
- `frontend/public/sw.js` (bump cache + agregar Landing.js a precache)

**Sin tocar:**
- `frontend/public/src/components/Login.js` (queda como fallback)
- `frontend/public/src/components/Ranking.js` (sigue igual)
- Schema DB (no hace falta migracion)
- `.env` (rate limit usa defaults)

## Out of scope

- i18n (landing en espanol, mismo idioma que el resto)
- A/B testing del mensaje del hero
- Analytics de conversion (cuantos visitantes hacen click en login)
- Animaciones de entrada del hero (fade-in, parallax)
- Compartir la landing en redes con preview card
- Cache del endpoint publico (se puede agregar despues con stale-while-revalidate)
- Endpoint publico de champion picks (no se filtra nada de campeones)
- Login con Apple/Facebook (sigue solo Google)
