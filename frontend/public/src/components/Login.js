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
