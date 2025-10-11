import { api } from '../../lib/http';
import { tokens } from '../../auth/tokenStore';
import type { Router } from 'expo-router';

export type ProfileData = { username: string; phone: string; email: string };

export async function fetchProfile(): Promise<ProfileData> {
  const me = await api('/api/users/me', { method: 'GET', auth: true });
  return {
    username: me?.username ?? '',
    phone: me?.phone ?? '',
    email: me?.email ?? '',
  };
}

export async function doLogout(router: Router) {
  tokens.clear();
  await tokens.clearStorage();         // ensure SecureStore is cleared
  router.replace('/(auth)/login');
}
