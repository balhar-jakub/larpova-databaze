import { validatePassword, isLegacyMd5, generatePbkdf2Hash } from '../auth/password';
import crypto from 'node:crypto';

describe('Password verification', () => {
  describe('PBKDF2', () => {
    it('validates a known PBKDF2 hash correctly', () => {
      const hash = generatePbkdf2Hash('secret123', 'test@example.com');
      // hash format: "1000:saltHex:hashHex"
      expect(hash).toMatch(/^1000:[0-9a-f]+:[0-9a-f]+$/);

      const valid = validatePassword('secret123', hash);
      expect(valid).toBe(true);
    });

    it('rejects wrong password', () => {
      const hash = generatePbkdf2Hash('secret123', 'test@example.com');
      expect(validatePassword('wrong', hash)).toBe(false);
    });

    it('uses email as salt correctly', () => {
      const email = 'user@csld.cz';
      const hash = generatePbkdf2Hash('mypassword', email);
      const [, saltHex] = hash.split(':');

      // Salt should be the email bytes hex-encoded
      const expectedSalt = Buffer.from(email, 'utf8').toString('hex');
      expect(saltHex).toBe(expectedSalt);
    });

    it('validates with iteration count from the stored hash', () => {
      // Manually generate with 500 iterations
      const salt = Buffer.from('custom@test.com', 'utf8');
      const hash = crypto.pbkdf2Sync('password', salt, 500, 64, 'sha1');
      const stored = `500:${salt.toString('hex')}:${hash.toString('hex')}`;

      expect(validatePassword('password', stored)).toBe(true);
    });

    it('produces 64-byte (512-bit) keys matching Java PBEKeySpec(64*8)', () => {
      const hash = generatePbkdf2Hash('test', 'a@b.com');
      const [, , hashHex] = hash.split(':');
      const hashBytes = Buffer.from(hashHex, 'hex');
      expect(hashBytes.length).toBe(64); // 64 bytes = 512 bits
    });

    it('rejects malformed hash', () => {
      expect(validatePassword('test', 'not-a-hash')).toBe(false);
      expect(validatePassword('test', '1000:abc')).toBe(false);
      expect(validatePassword('test', '')).toBe(false);
    });

    it('rejects empty password input', () => {
      const hash = generatePbkdf2Hash('somepass', 'empty@test.com');
      expect(validatePassword('', hash)).toBe(false); // empty input rejected
    });
  });

  describe('MD5 (legacy)', () => {
    it('validates legacy MD5 hash', () => {
      // MD5 of "oldpassword" in UTF-8
      const md5Hash = crypto.createHash('md5').update('oldpassword', 'utf8').digest('hex');
      expect(isLegacyMd5(md5Hash)).toBe(true);
      expect(validatePassword('oldpassword', md5Hash)).toBe(true);
    });

    it('rejects wrong password for MD5', () => {
      const md5Hash = crypto.createHash('md5').update('oldpassword', 'utf8').digest('hex');
      expect(validatePassword('wrong', md5Hash)).toBe(false);
    });

    it('isLegacyMd5 detects format correctly', () => {
      expect(isLegacyMd5('d41d8cd98f00b204e9800998ecf8427e')).toBe(true);
      expect(isLegacyMd5('1000:abc:def')).toBe(false);
    });
  });

  describe('generatePbkdf2Hash', () => {
    it('generates valid hash with 1000 iterations', () => {
      const hash = generatePbkdf2Hash('pass', 'e@mail.com');
      const [iter, saltHex, hashHex] = hash.split(':');
      expect(iter).toBe('1000');
      expect(saltHex).toBeTruthy();
      expect(hashHex).toBeTruthy();
    });
  });
});
