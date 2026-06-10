export default {
  props: ['authLoading', 'authError'],
  emits: ['login'],
  template: `
    <div class="login-screen">
      <div class="login-card">
        <header class="app-header">
          <img src="/assets/logo.png" alt="Copa Mundial 2026" class="header-title-img">
        </header>
        
        <h2 class="welcome-text">¡BIENVENIDO!</h2>
        <p class="login-desc">Ingresa con tu cuenta de Google para participar.</p>

        <button class="btn btn-primary btn-brush w-full" @click="$emit('login')" :disabled="authLoading" style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
          <span v-if="!authLoading" style="font-size: 1.3rem;">🔵</span>
          {{ authLoading ? 'CONECTANDO...' : 'INGRESAR CON GOOGLE' }}
        </button>

        <p v-if="authError" class="error-text" style="color: var(--color-red); margin-top: 1rem;">{{ authError }}</p>
      </div>

      <div class="login-footer"></div>
    </div>
  `
};
