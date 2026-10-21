/**
 * Remember-me key resolution with a production fail-fast.
 *
 * Same playbook as SESSION_SECRET (sessionSecret.ts): rememberMe.ts used to
 * silently sign its 30-day auto-login cookies with a hard-coded fallback key
 * when REMEMBER_ME_KEY was unset. The key is public in the repo, so anyone
 * could forge `LoggedIn` cookies for ANY user id — including admins — on any
 * instance that ran without the env var (a forged-cookie PoC against the live
 * test instance authenticated as the ADMIN account). Two failure modes,
 * same as the session secret:
 *  a) every instance without the env var shares one public "signing key"
 *     → auth bypass is trivial;
 *  b) a typo in the env name flips production to the fallback overnight.
 *
 * Now: production refuses to boot without a real key. Dev/test keep the
 * fallback with a loud warning so local `yarn dev` stays frictionless.
 */

/** Minimum length — HMAC-SHA256 signing key; short keys are brute-forceable. */
const MIN_KEY_LENGTH = 32;

export function requireRememberMeKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.REMEMBER_ME_KEY;
  const isProduction = env.NODE_ENV === 'production';

  if (key && key.length >= MIN_KEY_LENGTH) {
    return key;
  }

  if (isProduction) {
    if (!key) {
      throw new Error(
        'REMEMBER_ME_KEY is not set. Refusing to start in production with a hard-coded fallback ' +
          '(remember-me cookie forgery risk — any user id could be signed). Set it in the environment (see deploy workflow).',
      );
    }
    throw new Error(
      `REMEMBER_ME_KEY must be at least ${MIN_KEY_LENGTH} characters, got ${key.length}. ` +
        'Refusing to start in production with a weak signing key.',
    );
  }

  // Dev/test fallback — loud on purpose.
  console.warn(
    `[remember-me] REMEMBER_ME_KEY missing or too short (${key ? key.length : 0} < ${MIN_KEY_LENGTH}); ` +
      'falling back to the dev key. This is fine locally, fatal in production.',
  );
  return 'csld-dev-remember-me-key-change-in-production';
}
