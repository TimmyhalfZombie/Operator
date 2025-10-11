// src/auth/tokenStore.ts
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'auth_tokens_v2';           // new atomic blob {access, refresh}
const LEGACY_ACCESS_KEY = 'auth_access_token_v1';
const LEGACY_REFRESH_KEY = 'auth_refresh_token_v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;

let ready = false;
let inFlight: Promise<void> | null = null;

type PersistOpts = { persist?: boolean };

function normalize(v?: string | null): string | null {
  if (!v) return null;
  const t = String(v).trim();
  return t ? t : null;
}

async function ensureLoaded(): Promise<void> {
  if (ready) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // Try v2 (atomic blob)
      const blob = await SecureStore.getItemAsync(STORAGE_KEY);
      if (blob) {
        try {
          const parsed = JSON.parse(blob);
          accessToken = normalize(parsed?.access);
          refreshToken = normalize(parsed?.refresh);
          return;
        } catch {
          // fall through to legacy migration
        }
      }

      // Migrate legacy v1 keys if present
      const a = await SecureStore.getItemAsync(LEGACY_ACCESS_KEY);
      const r = await SecureStore.getItemAsync(LEGACY_REFRESH_KEY);
      accessToken = normalize(a);
      refreshToken = normalize(r);

      if (accessToken || refreshToken) {
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify({ access: accessToken, refresh: refreshToken })
        );
        await SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY);
        await SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY);
      }
    } finally {
      ready = true;
      inFlight = null;
    }
  })();

  return inFlight;
}

// Prime the load as soon as the module is imported (best-effort)
void ensureLoaded();

async function persistCurrent(): Promise<void> {
  // Atomic write or delete if empty
  if (accessToken || refreshToken) {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ access: accessToken, refresh: refreshToken })
    );
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }
}

export const tokens = {
  // ---- runtime state ----
  async set(a?: string | null, r?: string | null, options?: PersistOpts) {
    // undefined = leave unchanged; null/'' = clear that token
    if (a !== undefined) accessToken = normalize(a);
    if (r !== undefined) refreshToken = normalize(r);
    if (options?.persist) {
      await persistCurrent();
    }
  },
  getAccess() { return accessToken; },           // sync (call waitUntilReady() first in callers)
  getRefresh() { return refreshToken; },         // sync
  async getAccessAsync() { await ensureLoaded(); return accessToken; },
  async getRefreshAsync() { await ensureLoaded(); return refreshToken; },

  clear(opts: PersistOpts = {}) {
    accessToken = null;
    refreshToken = null;
    return opts.persist ? SecureStore.deleteItemAsync(STORAGE_KEY) : Promise.resolve();
  },

  // ---- persistence ----
  async loadFromStorage() { await ensureLoaded(); },
  async saveToStorage() { await ensureLoaded(); await persistCurrent(); },
  async clearStorage() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY);
    await SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY);
    accessToken = null;
    refreshToken = null;
  },

  // ---- readiness helpers (back-compat) ----
  waitUntilReady: ensureLoaded,
  isReady() { return ready; },
};
