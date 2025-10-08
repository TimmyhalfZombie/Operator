// client/src/lib/http.ts
import { API_URL } from './env';

type FetchOptions = Omit<RequestInit, 'body'> & { body?: any };

export async function api(path: string, opts: FetchOptions = {}) {
  const url = `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    const err = new Error(msg) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
