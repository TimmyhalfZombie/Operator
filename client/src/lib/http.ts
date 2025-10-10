// src/lib/http.ts
import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

type FetchOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: any;
  headers?: Record<string, string>;
  auth?: boolean; // when true we’ll attach Bearer token
};

export async function api(path: string, opts: FetchOptions = {}) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = await resolveApiBaseUrl();
  const url = `${base}${p}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  // ⬇️ Ensure tokens are loaded, then attach Authorization
  if (opts.auth) {
    await tokens.waitUntilReady?.();        // no-op if already ready
    const t = tokens.getAccess();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const status = res.status;
    const serverMsg = (data && (data.message || data.error)) || `HTTP ${status}`;
    const err = new Error(serverMsg) as any;
    err.status = status;
    err.data = data;
    throw err;
  }
  return data;
}
