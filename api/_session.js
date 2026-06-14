import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'aliv-dev-secret-change-me';
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

function toBase64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

export function createToken(username) {
  const payload = toBase64Url(
    Buffer.from(JSON.stringify({ u: username, exp: Date.now() + THIRTY_DAYS }))
  );
  const sig = toBase64Url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, sig] = token.split('.');
  const expected = toBase64Url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  if (sig !== expected) return null;

  try {
    const data = JSON.parse(fromBase64Url(payload).toString());
    if (!data.u || !data.exp || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}
