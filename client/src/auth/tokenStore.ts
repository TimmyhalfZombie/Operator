let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokens = {
  set(a?: string, r?: string) { if (a) accessToken = a; if (r) refreshToken = r; },
  getAccess() { return accessToken; },
  getRefresh() { return refreshToken; },
  clear() { accessToken = null; refreshToken = null; },
};
