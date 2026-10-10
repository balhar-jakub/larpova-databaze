/**
 * Session secret resolution with a production fail-fast.
 *
 * Phase 1 of the tech-debt roadmap: the app used to silently fall back to a
 * hard-coded dev secret when SESSION_SECRET was unset. Two failure modes:
 *  a) every prod instance secretly shares one public "secret" → session
 *     forgery is trivial;
 *  b) a typo in the env name flipped production to the fallback overnight.
 *
 * Now: production refuses to boot without a real secret. Dev/test keep the
 * fallback with a loud warning so local `yarn dev` stays frictionless.
 */

/** Minimum length — express-session signs with HMAC; short secrets are brute-forceable. */
const MIN_SECRET_LENGTH = 32;

export function requireSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  const isProduction = env.NODE_ENV === 'production';

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return secret;
  }

  if (isProduction) {
    if (!secret) {
      throw new Error(
        'SESSION_SECRET is not set. Refusing to start in production with a hard-coded fallback ' +
          '(session forgery risk). Set SESSION_SECRET in the environment (see deploy workflow).',
      );
    }
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters, got ${secret.length}. ` +
        'Refusing to start in production with a weak secret.',
    );
  }

  // Dev/test fallback — loud on purpose.
  console.warn(
    `[session-secret] SESSION_SECRET missing or too short (${secret ? secret.length : 0} < ${MIN_SECRET_LENGTH}); ` +
      'falling back to the dev secret. This is fine locally, fatal in production.',
  );
  return 'csld-dev-secret-change-in-production';
}
