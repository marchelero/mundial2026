export default {
  props: ['user', 'currentView', 'isAdmin', 'appVersion', 'notification'],
  emits: ['change-view', 'logout', 'clear-notification'],
  data() {
    return {
      deferredPrompt: window.__DEFERRED_PROMPT || null, showInstallBtn: !!window.__DEFERRED_PROMPT, showMenu: false,
      darkMode: localStorage.getItem('darkMode') === 'true'
    };
  },
  mounted() {
    document.body.classList.toggle('dark-mode', this.darkMode);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBtn = true;
      window.__DEFERRED_PROMPT = e;
    });
    window.addEventListener('appinstalled', () => {
      this.showInstallBtn = false;
      this.deferredPrompt = null;
      window.__DEFERRED_PROMPT = null;
    });
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) this.showMenu = false;
    });
  },
  methods: {
    toggleDark() {
      this.darkMode = !this.darkMode;
      document.body.classList.toggle('dark-mode', this.darkMode);
      localStorage.setItem('darkMode', this.darkMode);
      window.dispatchEvent(new CustomEvent('dark-mode-change', { detail: { darkMode: this.darkMode } }));
    },
    async installApp() {
      const p = this.deferredPrompt || window.__DEFERRED_PROMPT;
      if (!p) return;
      p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === 'accepted') {
        this.showInstallBtn = false;
        this.deferredPrompt = null;
        window.__DEFERRED_PROMPT = null;
      }
    }
  },
  template: `
    <div class="app-layout">
      <div v-if="notification.visible" class="toast" :class="'toast-' + notification.type" @click="$emit('clear-notification')">
        <template v-if="notification.match">
          <img :src="notification.homeFlagUrl" alt="" style="width:20px;height:14px;border-radius:2px;flex-shrink:0;">
          <span style="font-weight:700;flex-shrink:0;">{{ notification.homeTeam }}</span>
          <span style="font-weight:800;color:#ffd700;flex-shrink:0;">{{ notification.homeScore }} - {{ notification.awayScore }}</span>
          <img :src="notification.awayFlagUrl" alt="" style="width:20px;height:14px;border-radius:2px;flex-shrink:0;">
          <span style="font-weight:700;flex-shrink:0;">{{ notification.awayTeam }}</span>
          <span style="opacity:0.85;font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;">— {{ notification.body }}</span>
        </template>
        <template v-else>
          <img v-if="notification.flagUrl" :src="notification.flagUrl" alt="" style="width:20px;height:14px;border-radius:2px;flex-shrink:0;">
          <span>{{ notification.message }}</span>
        </template>
        <span class="toast-close">✕</span>
      </div>

      <header class="app-header">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 1rem; position: relative;">
           <div style="display: flex; align-items: center; gap: 0.75rem;">
             <img src="/assets/logo.png" alt="Logo" style="height: 78px; width: auto;">
           </div>
           <div style="display: flex; align-items: center; gap: 0.75rem;">
              <button v-if="showInstallBtn" @click="installApp" class="install-btn" title="Instalar app">📲</button>
              <span class="version-pill" style="font-size: 0.6rem; font-weight: 600; padding: 0.15rem 0.4rem; border-radius: 3px; background: var(--color-gray); color: white;">v{{ appVersion }}</span>
              <span class="admin-pill" style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 4px; background: var(--color-dark); color: white;">{{ isAdmin ? 'ADMIN' : 'INVITADO' }}</span>
             <div class="user-menu" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; position: relative;" @click.stop="showMenu = !showMenu">
               <span style="font-size: 0.8rem; font-weight: bold;">{{ user?.name || user?.email?.split('@')[0] }}</span>
               <span style="font-size: 1.2rem;">👤</span>
              <div v-if="showMenu" class="user-menu-panel" data-dark-bg="card" data-dark-border="border" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 200; padding: 0.75rem;">
                <div data-dark-text="text" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.15rem;">{{ user?.name || user?.email?.split('@')[0] }}</div>
                <div class="user-email" data-dark-text="gray" style="font-size: 0.7rem; color: var(--color-gray); margin-bottom: 0.75rem; word-break: break-all;">{{ user?.email }}</div>
                 <div v-if="showInstallBtn" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.5rem; margin-bottom: 0.5rem;">
                   <button @click="installApp" class="install-menu-btn" style="width: 100%; padding: 0.5rem; border: none; border-radius: 6px; background: #f0fdf4; color: var(--color-green); font-weight: 600; cursor: pointer; font-size: 0.8rem;"> INSTALAR APP</button>
                 </div>
                 <div style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.5rem; margin-bottom: 0.5rem;">
                   <button @click="toggleDark" data-dark-text="text" style="width: 100%; padding: 0.5rem; border: none; border-radius: 6px; background: var(--color-subtle); color: var(--color-text); font-weight: 600; cursor: pointer; font-size: 0.8rem;">{{ darkMode ? '☀️ MODO CLARO' : '🌙 MODO OSCURO' }}</button>
                 </div>
                <div style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.5rem;">
                  <button @click="$emit('logout')" class="logout-menu-btn" style="width: 100%; padding: 0.5rem; border: none; border-radius: 6px; background: #fef2f2; color: var(--color-red); font-weight: 600; cursor: pointer; font-size: 0.8rem;">🚪 CERRAR SESIÓN</button>
                </div>
              </div>
             </div>
           </div>
        </div>
      </header>

      <main class="app-main">
        <slot></slot>
      </main>

      <nav class="bottom-nav">
        <button class="nav-item" :class="{active: currentView === 'votar'}" @click="$emit('change-view', 'votar')">
          <span class="nav-icon">📅</span>
          <span>PARTIDOS</span>
        </button>
        <button class="nav-item" :class="{active: currentView === 'historial'}" @click="$emit('change-view', 'historial')">
          <span class="nav-icon">📋</span>
          <span>PRONÓSTICOS</span>
        </button>
        <button class="nav-item" :class="{active: currentView === 'posiciones'}" @click="$emit('change-view', 'posiciones')">
          <span class="nav-icon">🏆</span>
          <span>RANKING</span>
        </button>
        <button v-if="isAdmin" class="nav-item" :class="{active: currentView === 'admin'}" @click="$emit('change-view', 'admin')">
          <span class="nav-icon">⚙️</span>
          <span>ADMIN</span>
        </button>
      </nav>
    </div>
  `
};
