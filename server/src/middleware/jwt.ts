import jwt from 'jsonwebtoken';
import { config } from '../config';

type JwtUser = { id: string; email: string };

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

export function signAccess(payload: JwtUser) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_EXPIRES });
}

export function signRefresh(payload: JwtUser) {
  // If you want a separate secret, add config.jwtRefreshSecret and use it here.
  return jwt.sign(payload, config.jwtSecret, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccess<T = JwtUser>(token: string) {
  return jwt.verify(token, config.jwtSecret) as T;
}
