import { renderGoogleButton } from '../services/auth.js';

export default {
  props: ['authLoading', 'authError'],
  emits: ['login'],
  mounted() {
    setTimeout(renderGoogleButton, 500);
  },
  template: `
    <div class="login-screen">
      <div class="login-card">
        <header class="app-header">
          <img src="/assets/logo.png" alt="Copa Mundial 2026" class="login-hero-logo">
        </header>
        
        <h2 class="welcome-text">¡BIENVENIDO!</h2>
        <p class="login-desc">Ingresa con tu cuenta de Google para participar.</p>

        <div id="google-signin-btn" style="display: flex; justify-content: center; min-height: 44px;"></div>

        <div v-if="originInfo" style="margin-top:1.2rem;padding:0.8rem;background:#fef3c7;border-radius:8px;font-size:0.8rem;color:#92400e;text-align:left;line-height:1.5">
          <b>⚠️ Login sin resolver</b><br>
          Si el botón de Google no funciona, abrí la <b>Consola (F12)</b> y fijate qué dice.<br>
          El error más común es que en <b>Google Cloud Console</b> falte agregar:<br>
          <code style="display:inline-block;background:#fff;padding:0.2rem 0.5rem;border-radius:4px;margin:0.3rem 0;font-size:0.85rem">{{ originInfo }}</code><br>
          en "Authorized JavaScript origins" del Client ID.
        </div>

        <p v-if="authError" class="error-text" style="color: var(--color-red); margin-top: 1rem;">{{ authError }}</p>
      </div>

      <div class="login-footer"></div>
    </div>
  `,
  computed: {
    originInfo() {
      const origin = window.location.origin;
      const port = window.location.port;
      const base = origin;
      if (port && port !== '80' && port !== '443') {
        return base;
      }
      return base;
    }
  }
};
