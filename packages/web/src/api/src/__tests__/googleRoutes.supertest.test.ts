import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createGoogleRouter, safeReturnTo } from '../auth/googleRoutes';
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
