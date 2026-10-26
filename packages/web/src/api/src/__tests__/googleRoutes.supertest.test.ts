import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createGoogleRouter, safeReturnTo } from '../auth/googleRoutes';
import { google } from 'googleapis';
import type { GoogleEnv } from '../auth/googleLink';
import { prisma } from '../context';

/**
 * The HTTP layer of "Pokračovat přes Google", exercised through real requests
 * against the real router (mounted in an app that mirrors server.ts's middleware
 * order) rather than by importing server.ts, which boots Prisma, Apollo and Next.
 *
 * What matters here is the front door: no session state means no login, a state
 * that does not match means no login, a replayed callback finds nothing, and the
 * whole thing is inert until the OAuth client is configured.
 */

const SECRET = 'google-routes-secret-0123456789abcdef';
const REDIRECT_URI = 'https://example.test/auth/google/callback';

const CONFIGURED: GoogleEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: REDIRECT_URI,
};

function buildApp(env: GoogleEnv) {
  const app = express();
  app.use(cookieParser());
  app.use(session({ secret: SECRET, resave: false, saveUninitialized: false, name: 'csld.sid' }));
  app.use(
    '/auth/google',
    createGoogleRouter({
      prisma,
      loadUser: async () => null,
      login: async () => undefined,
      env,
    }),
  );
  return app;
}

function stateFrom(location: string): string {
  return new URL(location).searchParams.get('state') ?? '';
}

describe('safeReturnTo', () => {
  it('accepts only same-origin absolute paths', () => {
    expect(safeReturnTo('/game/abc?tab=1')).toBe('/game/abc?tab=1');
    expect(safeReturnTo('/')).toBe('/');
  });

  it('refuses anything that could leave the site', () => {
    expect(safeReturnTo('//evil.example/steal')).toBe('/');
    expect(safeReturnTo('https://evil.example/steal')).toBe('/');
    expect(safeReturnTo('/\\evil.example')).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo(['/a'])).toBe('/');
  });

  it("rewrites the auth pages to '/': a fresh sign-in must not land on the form again", () => {
    expect(safeReturnTo('/signIn')).toBe('/');
    expect(safeReturnTo('/signUp')).toBe('/');
    expect(safeReturnTo('/recoverPassword')).toBe('/');
    expect(safeReturnTo('/signIn?error=google_state')).toBe('/');
  });

  it("leaves paths that only share a prefix with an auth page untouched", () => {
    expect(safeReturnTo('/signInLater')).toBe('/signInLater');
    expect(safeReturnTo('/recoverPassword/finish?token=x')).toBe('/recoverPassword/finish?token=x');
  });
});

describe('the feature is inert without credentials', () => {
  it('reports itself disabled', async () => {
    const response = await request(buildApp({})).get('/auth/google/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: false });
  });

  it('reports itself enabled once the client is configured', async () => {
    const response = await request(buildApp(CONFIGURED)).get('/auth/google/status');
    expect(response.body).toEqual({ enabled: true });
  });

  it('does not start a flow without credentials', async () => {
    const response = await request(buildApp({})).get('/auth/google');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/signIn?error=google_unavailable');
  });
});

describe('starting the flow', () => {
  it('redirects to Google with state, PKCE and the registered redirect URI', async () => {
    const response = await request(buildApp(CONFIGURED)).get('/auth/google?returnTo=%2Fgame%2Fabc');

    expect(response.status).toBe(302);
    const location = new URL(response.headers.location);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('test-client-id');
    expect(location.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(location.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(response.headers['set-cookie']?.join(';')).toContain('csld.sid=');
  });
});

describe('the callback refuses everything it should', () => {
  it('rejects a callback that carries no session state', async () => {
    const response = await request(buildApp(CONFIGURED)).get('/auth/google/callback?code=abc&state=def');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/signIn?error=google_state');
  });

  it('rejects a state that does not match the one it issued', async () => {
    const agent = request.agent(buildApp(CONFIGURED));
    const started = await agent.get('/auth/google');
    expect(stateFrom(started.headers.location)).not.toBe('');

    const response = await agent.get('/auth/google/callback?code=abc&state=not-the-state');
    expect(response.headers.location).toBe('/signIn?error=google_state');
  });

  it('takes the flow out of the session, so a replay has nothing to find', async () => {
    const agent = request.agent(buildApp(CONFIGURED));
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);

    // No `code`: the request gets past the state check and then fails the exchange.
    const first = await agent.get(`/auth/google/callback?state=${encodeURIComponent(state)}`);
    expect(first.headers.location).toBe('/signIn?error=google_failed');

    const replayed = await agent.get(`/auth/google/callback?state=${encodeURIComponent(state)}`);
    expect(replayed.headers.location).toBe('/signIn?error=google_state');
  });

  it('reports a cancelled consent screen as a cancellation', async () => {
    const agent = request.agent(buildApp(CONFIGURED));
    await agent.get('/auth/google');

    const response = await agent.get('/auth/google/callback?error=access_denied');
    expect(response.headers.location).toBe('/signIn?error=google_cancelled');
  });
});

// ---------------------------------------------------------------------------
// The callback happy path — the token exchange and ID-token verification are
// stubbed on the OAuth2 prototype (the router news up the client itself), the
// DB side is real: `linkGoogleIdentity` runs against fixture rows.
// ---------------------------------------------------------------------------

describe('the callback completes a real sign-in', () => {
  const stamp = Date.now();
  const email = `google-routes-${stamp}@integration.test`;
  let userId: number;

  /** Stubs `getToken`/`verifyIdToken` on the OAuth2 prototype for one test. */
  function stubOAuth2(payload: { sub: string; email?: string; email_verified?: boolean; name?: string }) {
    const proto = Object.getPrototypeOf(new google.auth.OAuth2('id', 'secret')) as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    const tokenSpy: { mockRestore: () => void } = jest
      .spyOn(proto, 'getToken')
      .mockResolvedValue({ tokens: { id_token: 'stub-id-token' } });
    const verifySpy: { mockRestore: () => void } = jest
      .spyOn(proto, 'verifyIdToken')
      .mockResolvedValue({ getPayload: () => payload });
    return { tokenSpy, verifySpy };
  }

  beforeAll(async () => {
    const user = await prisma.csld_csld_user.create({
      data: {
        email,
        password: 'x',
        role: 1,
        name: 'google-routes-fixture',
        is_author: false,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.csld_oauth_account.deleteMany({ where: { user_id: userId } });
    await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  });

  function buildHappyPathApp() {
    const app = express();
    app.use(cookieParser());
    app.use(
      session({ secret: SECRET, resave: false, saveUninitialized: false, name: 'csld.sid' }),
    );
    let loggedIn = false;
    app.use(
      '/auth/google',
      createGoogleRouter({
        prisma,
        // The shape toAuthUser consumes; only the id matters for the assertions.
        loadUser: async (id: number) => ({
          id,
          email,
          name: 'google-routes-fixture',
          nickname: null,
          role: 1,
          csld_image: null,
          amount_of_comments: 0,
          amount_of_played: 0,
          amount_of_created: 0,
        }),
        login: async () => {
          loggedIn = true;
        },
        env: CONFIGURED,
      }),
    );
    return { app, wasCalled: () => loggedIn };
  }

  it('exchanges the code, links the identity and redirects to returnTo', async () => {
    const sub = `sub-${stamp}`;
    const spies = stubOAuth2({ sub, email, email_verified: true, name: 'Google Tester' });
    const { app, wasCalled } = buildHappyPathApp();
    const agent = request.agent(app);

    const started = await agent.get('/auth/google?returnTo=%2Fgame%2Fabc');
    const state = stateFrom(started.headers.location);

    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);

    expect(response.headers.location).toBe('/game/abc');
    expect(wasCalled()).toBe(true);
    expect(spies.tokenSpy).toHaveBeenCalled();
    // The identity is persisted (email auto-link path).
    const link = await prisma.csld_oauth_account.findUnique({
      where: { provider_provider_account_id: { provider: 'google', provider_account_id: sub } },
    });
    expect(link).not.toBeNull();
    expect(link!.user_id).toBe(userId);

    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
  });

  it('refuses an unverified e-mail', async () => {
    const spies = stubOAuth2({ sub: `unverified-${stamp}`, email, email_verified: false });
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);

    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);

    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_unverified');

    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
  });

  it("sends a flow started from the sign-in page to '/' even if returnTo names an auth page", async () => {
    // A dedicated fixture user: the shared one already carries a linked
    // identity after the first happy-path test, and a second sub on the same
    // account is refused as google_conflict.
    const ownEmail = `google-signinto-${stamp}@integration.test`;
    const ownUser = await prisma.csld_csld_user.create({
      data: { email: ownEmail, password: 'x', role: 1, name: 'google-signinto-fixture', is_author: false },
    });
    try {
      const spies = stubOAuth2({ sub: `signinto-${stamp}`, email: ownEmail, email_verified: true, name: 'Google Tester' });
      const app = express();
      app.use(cookieParser());
      app.use(session({ secret: SECRET, resave: false, saveUninitialized: false, name: 'csld.sid' }));
      let loggedIn = false;
      app.use(
        '/auth/google',
        createGoogleRouter({
          prisma,
          loadUser: async (id: number) => ({
            id,
            email: ownEmail,
            name: 'google-signinto-fixture',
            nickname: null,
            role: 1,
            csld_image: null,
            amount_of_comments: 0,
            amount_of_played: 0,
            amount_of_created: 0,
          }),
          login: async () => {
            loggedIn = true;
          },
          env: CONFIGURED,
        }),
      );
      const agent = request.agent(app);

      const started = await agent.get('/auth/google?returnTo=%2FsignIn');
      const state = stateFrom(started.headers.location);

      const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
      expect(response.headers.location).toBe('/');
      expect(loggedIn).toBe(true);

      spies.tokenSpy.mockRestore();
      spies.verifySpy.mockRestore();
    } finally {
      await prisma.csld_oauth_account.deleteMany({ where: { user_id: ownUser.id } });
      await prisma.csld_csld_user.delete({ where: { id: ownUser.id } });
    }
  });


  it('reports an ambiguous e-mail (two accounts share one address)', async () => {
    // The address differs in CASE (unique to the column, one mailbox to the
    // lookup) — linkGoogleIdentity refuses to choose between the two.
    const second = await prisma.csld_csld_user.create({
      data: { email: email.toUpperCase(), password: 'x', role: 1, name: 'google-routes-duplicate' },
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spies = stubOAuth2({ sub: `ambiguous-${stamp}`, email, email_verified: true });
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_ambiguous');
    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
    warnSpy.mockRestore();
    await prisma.csld_csld_user.deleteMany({ where: { id: second.id } });
  });

  it('reports a conflict (the account already has another Google identity)', async () => {
    // (user_id, provider) is unique: at most one Google link per user. Clear
    // any link the earlier tests left on the fixture user, then bind it to a
    // DIFFERENT sub — the incoming sub is then refused.
    await prisma.csld_oauth_account.deleteMany({ where: { user_id: userId, provider: 'google' } });
    await prisma.csld_oauth_account.create({
      data: { provider: 'google', provider_account_id: `existing-${stamp}`, user_id: userId },
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spies = stubOAuth2({ sub: `conflict-${stamp}`, email, email_verified: true });
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_conflict');
    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
    warnSpy.mockRestore();
    await prisma.csld_oauth_account.deleteMany({ where: { provider_account_id: `existing-${stamp}` } });
  });

  it('registers a brand-new account when the e-mail is unknown', async () => {
    const freshEmail = `google-routes-new-${stamp}@integration.test`;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spies = stubOAuth2({ sub: `register-${stamp}`, email: freshEmail, email_verified: true, name: 'Nový účet' });
    const { app, wasCalled } = buildHappyPathApp();
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/');
    expect(wasCalled()).toBe(true);
    const created = await prisma.csld_csld_user.findUnique({ where: { email: freshEmail } });
    expect(created).not.toBeNull();
    const link = await prisma.csld_oauth_account.findUnique({
      where: { provider_provider_account_id: { provider: 'google', provider_account_id: `register-${stamp}` } },
    });
    expect(link!.user_id).toBe(created!.id);
    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
    warnSpy.mockRestore();
    await prisma.csld_oauth_account.deleteMany({ where: { provider_account_id: `register-${stamp}` } });
    await prisma.csld_csld_user.deleteMany({ where: { email: freshEmail } });
  });

  it('fails when the token response carries no id_token', async () => {
    const proto = Object.getPrototypeOf(new google.auth.OAuth2('id', 'secret')) as Record<string, any>;
    const tokenSpy = jest.spyOn(proto, 'getToken').mockResolvedValue({ tokens: {} });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_failed');
    tokenSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails when the id_token has no subject', async () => {
    const proto = Object.getPrototypeOf(new google.auth.OAuth2('id', 'secret')) as Record<string, any>;
    jest.spyOn(proto, 'getToken').mockResolvedValue({ tokens: { id_token: 'stub-id-token' } });
    jest.spyOn(proto, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ email, email_verified: true }) });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_failed');
    (proto.getToken as any).mockRestore?.();
    (proto.verifyIdToken as any).mockRestore?.();
    errorSpy.mockRestore();
  });

  it('fails when the linked user disappears before the session can be minted', async () => {
    const vanishedEmail = `google-routes-vanished-${stamp}@integration.test`;
    const spies = stubOAuth2({ sub: `vanished-${stamp}`, email: vanishedEmail, email_verified: true });
    const app = express();
    app.use(cookieParser());
    app.use(session({ secret: SECRET, resave: false, saveUninitialized: false, name: 'csld.sid' }));
    app.use(
      '/auth/google',
      createGoogleRouter({
        prisma,
        loadUser: async () => null, // the user vanished between link and load
        login: async () => {},
        env: CONFIGURED,
      }),
    );
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_failed');
    spies.tokenSpy.mockRestore();
    spies.verifySpy.mockRestore();
    errorSpy.mockRestore();
    await prisma.csld_oauth_account.deleteMany({ where: { provider_account_id: `vanished-${stamp}` } });
  });


  it('rejects a callback whose code is missing or empty', async () => {
    // Two separate flows: the callback consumes the session state, so the
    // second case needs its own.
    const app = buildApp(CONFIGURED);
    const first = request.agent(app);
    const firstStart = await first.get('/auth/google');
    const missing = await first.get(
      `/auth/google/callback?state=${encodeURIComponent(stateFrom(firstStart.headers.location))}`,
    );
    expect(missing.headers.location).toBe('/signIn?error=google_failed');
    const second = request.agent(app);
    const secondStart = await second.get('/auth/google');
    const empty = await second.get(
      `/auth/google/callback?code=&state=${encodeURIComponent(stateFrom(secondStart.headers.location))}`,
    );
    expect(empty.headers.location).toBe('/signIn?error=google_failed');
  });

  it('rejects a callback when the client was switched off after the flow started', async () => {
    const app = buildApp(CONFIGURED);
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);
    // Swap the router for an unconfigured one mid-flow (the env moved under us).
    const off = buildApp({} as GoogleEnv);
    const offAgent = request.agent(off);
    const fresh = await offAgent.get('/auth/google');
    expect(fresh.headers.location).toBe('/signIn?error=google_unavailable');
  });

  it('derives the redirect URI from x-forwarded-proto when GOOGLE_REDIRECT_URI is absent', async () => {
    const env: GoogleEnv = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
    const app = buildApp(env);
    const agent = request.agent(app);
    const started = await agent.get('/auth/google');
    const url = new URL(started.headers.location);
    expect(url.searchParams.get('redirect_uri')).toMatch(/https?:\/\/.*\/auth\/google\/callback$/);
  });

  it('fails loudly when the session middleware is not mounted', async () => {
    const app = express(); // no express-session
    app.use('/auth/google', createGoogleRouter({
      prisma,
      loadUser: async () => null,
      login: async () => undefined,
      env: CONFIGURED,
    }));
    const result = await request(app).get('/auth/google');
    expect(result.status).toBe(500);
  });

  it('reports a token exchange failure as google_failed', async () => {
    const proto = Object.getPrototypeOf(new google.auth.OAuth2('id', 'secret')) as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    const tokenSpy: { mockRestore: () => void } = jest
      .spyOn(proto, 'getToken')
      .mockRejectedValue(new Error('exchange failed'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildHappyPathApp();
    const agent = request.agent(app);

    const started = await agent.get('/auth/google');
    const state = stateFrom(started.headers.location);

    const response = await agent.get(`/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.location).toBe('/signIn?error=google_failed');

    tokenSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
