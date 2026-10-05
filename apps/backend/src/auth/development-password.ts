import { randomBytes } from 'crypto';

/** Uses a predictable password only for local/test account creation. */
export function accountCreationPassword() {
  if (process.env.NODE_ENV !== 'production' && process.env.DEVELOPMENT_DEFAULT_PASSWORD) {
    return process.env.DEVELOPMENT_DEFAULT_PASSWORD;
  }
  return `DAVI-${randomBytes(6).toString('base64url')}`;
}
