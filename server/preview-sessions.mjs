export const PREVIEW_COOKIE_NAME = '__Host-stv_preview_access';
export const PREVIEW_SESSION_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();
const READ_SQL = `SELECT 1 AS allowed
FROM preview_sessions
WHERE token_hash = ? AND policy_version = ? AND expires_at > ?
LIMIT 1`;
const WRITE_SQL = `INSERT INTO preview_sessions (token_hash, attested_at, expires_at, policy_version)
VALUES (?, ?, ?, ?)`;
const DELETE_EXPIRED_SQL = `DELETE FROM preview_sessions
WHERE expires_at <= ?`;

function secureRandomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function tokenHash(token) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request) {
  const header = request.headers.get('cookie') || '';
  const matches = [];
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (name === PREVIEW_COOKIE_NAME) matches.push(value);
  }
  if (matches.length !== 1 || !/^[A-Za-z0-9_-]{43}$/u.test(matches[0])) return null;
  return matches[0];
}

export async function createPreviewSession(db, policyVersion, now = new Date(), randomBytes = secureRandomBytes) {
  if (!db || !policyVersion) throw new Error('Preview session storage is unavailable.');
  const bytes = randomBytes(32);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) throw new Error('Preview session entropy is unavailable.');
  const token = base64Url(bytes);
  const attestedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PREVIEW_SESSION_SECONDS * 1000).toISOString();
  await db.prepare(DELETE_EXPIRED_SQL).bind(attestedAt).run();
  await db.prepare(WRITE_SQL).bind(await tokenHash(token), attestedAt, expiresAt, policyVersion).run();
  return token;
}

export async function hasValidPreviewSession(db, request, policyVersion, now = new Date()) {
  if (!db || !policyVersion) throw new Error('Preview session storage is unavailable.');
  const token = cookieValue(request);
  if (!token) return false;
  const row = await db.prepare(READ_SQL).bind(await tokenHash(token), policyVersion, now.toISOString()).first();
  return Boolean(row?.allowed);
}

export function previewSessionCookie(token) {
  return `${PREVIEW_COOKIE_NAME}=${token}; Path=/; Max-Age=${PREVIEW_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
