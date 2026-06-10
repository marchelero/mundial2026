import { pb } from './pb.js';

export async function loginGoogle() {
    try {
        const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
        return authData.record;
    } catch (e) {
        console.error('Login error:', e);
        const errorMsg = e.message?.includes('popup') ? 'Bloqueador de popups detectado.' : (e.message || 'Error al conectar');
        throw new Error(errorMsg);
    }
}

export function logout() {
    pb.authStore.clear();
}

export async function refreshAuth() {
    if (pb.authStore.isValid) {
        try {
            const { record } = await pb.collection('users').authRefresh();
            return record;
        } catch (_) {
            pb.authStore.clear();
        }
    }
    return null;
}
