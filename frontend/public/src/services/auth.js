import { api } from './api.js';

export async function loginGoogle(credential) {
  try {
    const result = await api.post('/auth/google', { credential });
    localStorage.setItem('token', result.token);
    window.dispatchEvent(new CustomEvent('google-login-success', { detail: result.user }));
    return result.user;
  } catch (e) {
    console.error('Login error:', e);
    throw e;
  }
}

export function renderGoogleButton() {
  const origin = window.location.origin;
  console.log('📍 Origin actual:', origin);

  const clientId = typeof GOOGLE_CLIENT_ID !== 'undefined' ? GOOGLE_CLIENT_ID : '';
  if (!clientId) {
    showGoogleError('GOOGLE_CLIENT_ID no configurado en public/config.js');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts) {
    showGoogleError('Google Identity Services no cargado (revisá internet o bloqueador de scripts)');
    return;
  }

  const container = document.getElementById('google-signin-btn');
  if (!container) {
    console.error('google-signin-btn container not found');
    return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      console.log('Google callback received');
      if (!response.credential) {
        console.error('No credential received');
        return;
      }
      try {
        await loginGoogle(response.credential);
      } catch (e) {
        console.error('Login failed:', e);
        const msg = e.message || '';
        showGoogleError(msg.includes('permitido') || msg.includes('no autorizado') ? msg : 'Error: ' + msg);
      }
    },
    auto_select: false,
    cancel_on_tap_outside: false,
    use_fedcm_for_button: false,
  });

  google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    width: 300,
  });

  console.log('Google button rendered');
}

export function showGoogleError(msg) {
  document.querySelectorAll('.login-error-box').forEach(el => el.remove());
  const container = document.getElementById('google-signin-btn');
  if (!container) return;
  const isWhitelist = msg.toLowerCase().includes('no autorizado') || msg.toLowerCase().includes('permitido');
  const err = document.createElement('div');
  err.className = 'login-error-box';
  err.style.cssText = 'margin: 1rem auto 0;padding:0.75rem;border-radius:6px;font-size:0.8rem;text-align:center;line-height:1.5;width:100%;max-width:300px;box-sizing:border-box;' + (isWhitelist
    ? 'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;'
    : 'background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;');
  err.innerHTML = isWhitelist
    ? '<div style="font-size:1.5rem;margin-bottom:0.25rem;">🚫</div><strong>Acceso restringido</strong><br>Tu correo no está autorizado. Contactá al administrador para que te agregue a la lista de permitidos.'
    : '<div style="font-size:1.5rem;margin-bottom:0.25rem;">⚠️</div>' + msg;
  container.insertAdjacentElement('afterend', err);
}

export function logout() {
  localStorage.removeItem('token');
  if (typeof google !== 'undefined' && google.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
}

export async function refreshAuth() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    // Intentar refrescar el token primero
    const result = await api.post('/auth/refresh');
    if (result.token) localStorage.setItem('token', result.token);
    return result.user;
  } catch (_) {
    localStorage.removeItem('token');
    return null;
  }
}
