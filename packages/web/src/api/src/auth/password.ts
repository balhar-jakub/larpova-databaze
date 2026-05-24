import crypto from 'node:crypto';

/**
 * CSLD password verification — exact replica of Java Pwd.java.
 *
 * PBKDF2 format: "iterations:saltHex:hashHex"
 *   - 1000 iterations, 64-byte (512-bit) key, SHA1
 *   - Salt = user's email as UTF-8 bytes
 *
 * MD5 format (legacy): plain lowercase hex of MD5(password), no salt.
 */

/**
 * Validate a plaintext password against a stored hash.
 * Detects format by presence of ':' delimiter.
 */
export function validatePassword(raw: string, stored: string): boolean {
  if (!raw || !stored) return false;
  return stored.includes(':')
    ? validatePbkdf2(raw, stored)
    : validateMd5(raw, stored);
}

/**
 * Check if a stored hash is legacy MD5 (needs upgrade to PBKDF2).
 */
export function isLegacyMd5(stored: string): boolean {
  return !stored.includes(':');
}

/**
 * Generate a PBKDF2 hash using email as salt.
 */
export function generatePbkdf2Hash(password: string, email: string): string {
  const iterations = 1000;
  const salt = Buffer.from(email, 'utf8');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha1');
  return `${iterations}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// ── Internal ─────────────────────────────────────────────

function validatePbkdf2(raw: string, stored: string): boolean {
  const [iterStr, saltHex, hashHex] = stored.split(':');
  if (!iterStr || !saltHex || !hashHex) return false;

  const iterations = parseInt(iterStr, 10);
  if (isNaN(iterations)) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');

  const derived = crypto.pbkdf2Sync(raw, salt, iterations, expectedHash.length, 'sha1');

  // Constant-time comparison
  if (derived.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(derived, expectedHash);
}

function validateMd5(raw: string, stored: string): boolean {
  const hash = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
  return hash === stored.toLowerCase();
}
