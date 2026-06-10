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
  const clientId = typeof GOOGLE_CLIENT_ID !== 'undefined' ? GOOGLE_CLIENT_ID : '';
  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID no configurado');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts) {
    console.error('Google Identity Services no cargado');
    return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      console.log('Google callback received:', response);
      if (!response.credential) {
        console.error('No credential received');
        return;
      }
      try {
        await loginGoogle(response.credential);
      } catch (e) {
        console.error('Login failed:', e);
      }
    },
  });

  const btn = document.getElementById('google-signin-btn');
  if (btn) {
    google.accounts.id.renderButton(btn, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 300,
    });
    console.log('Google button rendered');
  } else {
    console.error('Google button container not found');
  }
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
