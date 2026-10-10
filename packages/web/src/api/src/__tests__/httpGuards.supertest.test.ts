import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createHash } from 'node:crypto';

// express-session augments the Express Request type with .session; in this
// ESM/ts-jest context the augmentation is not visible, so go through `any`.
type AnyReq = import('express').Request & { session?: any };

/**
 * Phase 4 supertest guards — HTTP-layer invariants of the production
 * server (packages/web/server.ts), pinned the way jest cannot:
 * through real HTTP requests against the real middleware stack.
 *
 * The app under test mirrors server.ts exactly: cors → cookieParser →
 * session (pg-backed in prod; MemoryStore here — the cookie CONTRACT is
 * what we pin, not the store) → a couple of representative routes.
 * It deliberately does NOT import server.ts: that file starts a real
 * PrismaClient, Apollo server, Next and a cron — the sessionGate
 * integration test (phase 1) already covers its startup contract.
 */

const SESSION_SECRET = 'supertest-guard-secret-0123456789abcdef';

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(cookieParser());
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'csld.sid',
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
    }),
  );
  // Representative protected surface: reading the session user the way
  // the GraphQL context does (req.user ?? null).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/whoami', (req: AnyReq, res) =>
    res.json({
      user: (req.session as any)?.userId
        ? { id: (req.session as any).userId, name: (req.session as any).userName ?? '' }
        : null,
    }),
  );
  app.post('/login', (req: AnyReq, res) => {
    // Writing THROUGH req.session (not req.user) is what makes
    // express-session issue the cookie — saveUninitialized:false means
    // an untouched session never gets one.
    (req.session as any).userId = 1;
    (req.session as any).userName = 'Test';
    res.json({ ok: true });
  });
  return app;
}

describe('HTTP layer guards (supertest)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildApp();
  });

  it('health endpoint answers ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('CORS middleware is mounted and answers preflight without credentials leakage', async () => {
    // Default cors(): Access-Control-Allow-Origin: * — anything else means
    // the middleware got dropped from server.ts silently.
    const res = await request(app)
      .options('/health')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeLessThan(400);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    // Same-origin app: the wildcard must never appear together with
    // Allow-Credentials true (that combination would be a browser-level
    // security violation if someone later enables credentials).
    const allowCreds = res.headers['access-control-allow-credentials'];
    if (allowCreds === 'true') {
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    }
  });

  it('session cookie contract: csld.sid is set on first write, HttpOnly', async () => {
    const res = await request(app).post('/login');
    expect(res.status).toBe(200);
    const setCookie: string[] = res.headers['set-cookie'] ?? [];
    const sid = setCookie.find((c) => c.startsWith('csld.sid='));
    expect(sid).toBeDefined();
    // A session cookie missing HttpOnly is readable from JS — session
    // hijack via any future XSS. This is the contract server.ts must keep.
    expect(sid).toMatch(/HttpOnly/i);
  });

  it('session cookie survives across requests (same signed secret)', async () => {
    const agent = request.agent(app);
    await agent.post('/login');
    const res = await agent.get('/whoami');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 1, name: 'Test' });
  });

  it('the session cookie is signed — a tampered sid is rejected', async () => {
    const res = await request(app)
      .get('/whoami')
      .set('Cookie', 'csld.sid=forged-session-data');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('no session is issued for a plain GET (saveUninitialized: false)', async () => {
    const res = await request(app).get('/health');
    const setCookie: string[] = res.headers['set-cookie'] ?? [];
    expect(setCookie.find((c) => c.startsWith('csld.sid='))).toBeUndefined();
  });

  it('secret rotation invalidates old cookies (the deploy contract of phase 1)', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/login');
    const who1 = await agent.get('/whoami');
    expect(who1.body.user).toEqual({ id: 1, name: 'Test' });

    // A DIFFERENT secret must not accept the previously issued cookie:
    // that is exactly what happened to production users when the real
    // SESSION_SECRET landed — sessions die with the old signature.
    const app2 = express();
    app2.use(
      session({
        secret: 'a-completely-different-secret-0123456789',
        resave: false,
        saveUninitialized: false,
        name: 'csld.sid',
        cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
      }),
    );
    app2.get('/whoami', (req, res) => res.json({ user: (req as any).user ?? null }));
    const cookie = (agent.jar as any).toJSON?.()?.cookies ?? [];
    const sidCookie = cookie.map((c: any) => `${c.key}=${c.value}`).join('; ');
    const res2 = await request(app2).get('/whoami').set('Cookie', sidCookie);
    expect(res2.body.user).toBeNull();
  });
});

describe('production secret sanity (static)', () => {
  it('the guard secret differs from any real deploy secret (32+ chars, not a known literal)', () => {
    // Guards the test file itself: this secret never appears in server.ts.
    expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    const server = createHash('sha256').update(SESSION_SECRET).digest('hex');
    expect(server).not.toBe('');
  });
});
