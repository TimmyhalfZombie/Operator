// client/src/auth/views/functions/auth.ts
import { api } from '../../../lib/http';

type LoginArgs = { identifier: string; password: string };
type RegisterArgs = { username: string; email: string; phone: string; password: string };
type ResetArgs = { identifier: string; newPassword: string };

export function loginWithIdentifier({ identifier, password }: LoginArgs) {
  return api('/api/auth/login', { method: 'POST', body: { identifier, password } });
}

export function registerUser({ username, email, phone, password }: RegisterArgs) {
  // If your server expects different path/field names, change here.
  return api('/api/auth/register', { method: 'POST', body: { username, email, phone, password } });
}

export function resetPassword({ identifier, newPassword }: ResetArgs) {
  return api('/api/auth/reset-password', { method: 'POST', body: { identifier, newPassword } });
}
