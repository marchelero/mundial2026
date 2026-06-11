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
        showGoogleError('Error del servidor: ' + (e.message || 'desconocido'));
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
  const container = document.getElementById('google-signin-btn');
  if (!container) return;
  const err = document.createElement('div');
  err.style.cssText = 'color:#dc2626;margin-top:0.8rem;font-size:0.85rem;text-align:center;line-height:1.4';
  err.textContent = msg;
  container.appendChild(err);
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
    const result = await api.get('/auth/me');
    return result.user;
  } catch (_) {
    localStorage.removeItem('token');
    return null;
  }
}
