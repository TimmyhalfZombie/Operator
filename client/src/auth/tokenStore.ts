import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'auth_tokens_v2';           // atomic blob {access, refresh}
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
          // fall back to legacy migration
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

async function persistCurrent(): Promise<void> {
  if (accessToken || refreshToken) {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ access: accessToken, refresh: refreshToken })
    );
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }
}

// --- lightweight JWT decoder (no verification, UI-only) --- //
function base64UrlDecode(input: string): string {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const padded = b64 + '='.repeat(pad);
    if (typeof atob === 'function') {
      // @ts-ignore atob might exist in RN Hermes
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } else {
      // Fallback for RN: Buffer is usually available
      // @ts-ignore
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch {
    return '';
  }
}
function decodeJwtPayload<T = any>(jwt?: string | null): T | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const json = base64UrlDecode(parts[1]);
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export const tokens = {
  async set(a?: string | null, r?: string | null, options?: PersistOpts) {
    if (a !== undefined) accessToken = normalize(a);
    if (r !== undefined) refreshToken = normalize(r);
    if (options?.persist) await persistCurrent();
  },
  getAccess() { return accessToken; },
  getRefresh() { return refreshToken; },
  async getAccessAsync() { await ensureLoaded(); return accessToken; },
  async getRefreshAsync() { await ensureLoaded(); return refreshToken; },

  clear(opts: PersistOpts = {}) {
    accessToken = null;
    refreshToken = null;
    return opts.persist ? SecureStore.deleteItemAsync(STORAGE_KEY) : Promise.resolve();
  },

  async loadFromStorage() { await ensureLoaded(); },
  async saveToStorage() { await ensureLoaded(); await persistCurrent(); },
  async clearStorage() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY);
    await SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY);
    accessToken = null;
    refreshToken = null;
  },

  waitUntilReady: ensureLoaded,
  isReady() { return ready; },

  // 🔹 UI helpers: read user id/name from the access token
  async getUserIdAsync(): Promise<string | null> {
    await ensureLoaded();
    const payload = decodeJwtPayload<any>(accessToken);
    // server (per your stack) signs payload with { id, name, email, phone, avatar }
    const id = payload?.id ?? payload?.sub ?? null;
    return id ? String(id) : null;
  },
  async getUserNameAsync(): Promise<string | null> {
    await ensureLoaded();
    const payload = decodeJwtPayload<any>(accessToken);
    const name = payload?.name ?? null;
    return name ? String(name) : null;
  },
};
