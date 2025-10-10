// src/auth/tokenStore.ts
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'auth_access_token_v1';
const REFRESH_KEY = 'auth_refresh_token_v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// readiness
let ready = false;
let inFlight: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (ready) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      accessToken = (await SecureStore.getItemAsync(ACCESS_KEY)) || null;
      refreshToken = (await SecureStore.getItemAsync(REFRESH_KEY)) || null;
    } finally {
      ready = true;
      inFlight = null;
    }
  })();

  return inFlight;
}

export const tokens = {
  // ---- runtime state ----
  async set(a?: string, r?: string, options?: { persist?: boolean }) {
    if (a) accessToken = a;
    if (r) refreshToken = r;
    if (options?.persist) {
      await this.saveToStorage();
    }
  },
  getAccess() { return accessToken; },
  getRefresh() { return refreshToken; },
  clear() { accessToken = null; refreshToken = null; },

  // ---- persistence ----
  async loadFromStorage() {
    // kept for callers already using this
    await ensureLoaded();
  },
  async saveToStorage() {
    if (accessToken) await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },
  async clearStorage() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    accessToken = null;
    refreshToken = null;
  },

  // ---- readiness helpers (back-compat) ----
  waitUntilReady: ensureLoaded,   // ← the function your app is calling
  isReady() { return ready; },
};
