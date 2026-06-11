export default {
    props: ['user', 'currentView', 'isAdmin', 'notification'],
    emits: ['change-view', 'logout', 'clear-notification'],
    data() {
        return { deferredPrompt: window.__DEFERRED_PROMPT || null, showInstallBtn: !!window.__DEFERRED_PROMPT, showMenu: false };
    },
    mounted() {
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
        async installApp() {
            const prompt = this.deferredPrompt || window.__DEFERRED_PROMPT;
            if (!prompt) return;
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
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
        <span>{{ notification.message }}</span>
        <span class="toast-close">✕</span>
      </div>

      <header class="app-header">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 1rem; position: relative;">
           <img src="/assets/logo.png" alt="Logo" style="height: 40px;">
           <div style="display: flex; align-items: center; gap: 0.75rem;">
             <button v-if="showInstallBtn" @click="installApp" class="install-btn" title="Instalar app">📲</button>
             <span style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 4px; background: var(--color-dark); color: white;">{{ isAdmin ? 'ADMIN' : 'INVITADO' }}</span>
             <div class="user-menu" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; position: relative;" @click.stop="showMenu = !showMenu">
               <span style="font-size: 0.8rem; font-weight: bold;">{{ user?.name || user?.email?.split('@')[0] }}</span>
               <span style="font-size: 1.2rem;">👤</span>
              <div v-if="showMenu" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 200; padding: 0.75rem;">
                <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.15rem;">{{ user?.name || user?.email?.split('@')[0] }}</div>
                <div style="font-size: 0.7rem; color: var(--color-gray); margin-bottom: 0.75rem; word-break: break-all;">{{ user?.email }}</div>
                <div v-if="showInstallBtn" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.5rem; margin-bottom: 0.5rem;">
                  <button @click="installApp" style="width: 100%; padding: 0.5rem; border: none; border-radius: 6px; background: #f0fdf4; color: var(--color-green); font-weight: 600; cursor: pointer; font-size: 0.8rem;">📲 INSTALAR APP</button>
                </div>
                <div style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.5rem;">
                  <button @click="$emit('logout')" style="width: 100%; padding: 0.5rem; border: none; border-radius: 6px; background: #fef2f2; color: var(--color-red); font-weight: 600; cursor: pointer; font-size: 0.8rem;">🚪 CERRAR SESIÓN</button>
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
