export default {
    props: ['user', 'currentView', 'isAdmin', 'notification'],
    emits: ['change-view', 'logout', 'clear-notification'],
    data() {
        return { deferredPrompt: null, showInstallBtn: false };
    },
    mounted() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBtn = true;
        });
        window.addEventListener('appinstalled', () => {
            this.showInstallBtn = false;
            this.deferredPrompt = null;
        });
    },
    methods: {
        async installApp() {
            if (!this.deferredPrompt) return;
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') this.showInstallBtn = false;
            this.deferredPrompt = null;
        }
    },
    template: `
    <div class="app-layout">
      <div v-if="notification.visible" class="toast" :class="'toast-' + notification.type" @click="$emit('clear-notification')">
        <span>{{ notification.message }}</span>
        <span class="toast-close">✕</span>
      </div>

      <header class="app-header">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 1rem;">
           <img src="/assets/logo.png" alt="Logo" style="height: 40px;">
           <div style="display: flex; align-items: center; gap: 0.75rem;">
             <button v-if="showInstallBtn" @click="installApp" class="install-btn" title="Instalar app">📲</button>
             <span style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.5rem; border-radius: 4px; background: var(--color-dark); color: white;">{{ isAdmin ? 'ADMIN' : 'INVITADO' }}</span>
             <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" @click="$emit('logout')">
               <span style="font-size: 0.8rem; font-weight: bold;">{{ user?.name || user?.email?.split('@')[0] }}</span>
               <span style="font-size: 1.2rem;">👤</span>
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
