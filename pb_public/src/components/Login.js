export default {
  props: ['authLoading', 'authError'],
  emits: ['login'],
  template: `
    <div class="login-screen">
      <div class="login-card">
        <header class="app-header">
          <img src="/assets/logo.png" alt="Copa Mundial 2026" class="login-hero-logo">
        </header>
        
        <h2 class="welcome-text">¡BIENVENIDO!</h2>
        <p class="login-desc">Ingresa con tu cuenta de Google para participar.</p>

        <button class="btn btn-google w-full" @click="$emit('login')" :disabled="authLoading">
          <span v-if="!authLoading" style="font-size: 1.2rem; font-weight: bold; color: #4285f4; margin-right: 0.5rem;">G</span>
          {{ authLoading ? 'CONECTANDO...' : 'INGRESAR CON GOOGLE' }}
        </button>

        <p v-if="authError" class="error-text" style="color: var(--color-red); margin-top: 1rem;">{{ authError }}</p>
      </div>

      <div class="login-footer"></div>
    </div>
  `
};
