import { api } from '../../../src/lib/http';
import { tokens } from '../../../src/auth/tokenStore';
import type { Router } from 'expo-router';

export type ProfileData = { username?: string; phone?: string; email: string };

export async function fetchProfile(): Promise<ProfileData> {
  const me = await api('/api/users/me', { method: 'GET', auth: true });
  return {
    username: me?.username ?? '',
    phone: me?.phone ?? '',
    email: me?.email ?? '',
  };
}

export function doLogout(router: Router) {
  tokens.clear();
  router.replace('/(auth)/login');
}
