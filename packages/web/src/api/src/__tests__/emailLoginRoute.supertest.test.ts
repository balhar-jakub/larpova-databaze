import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createEmailLoginRouter } from '../auth/emailLoginRoute';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * The magic-link callback (`GET /auth/email-login?token=…`) exercised through a
 * real request against the real router, mounted like server.ts mounts it. The
 * router is a factory so the Passport `req.login` stays injectable.
 *
 * What matters here: a valid token logs the account in AND records
 * `csld_csld_user.last_login` (site-usage audit 2026-11-01 — before this, only
 * `csld_email_authentication.created_at` traced magic-link logins), while an
 * invalid or expired token never touches the account.
 */

const stamp = Date.now();
const email = `email-login-${stamp}@integration.test`;

let userId: number;

beforeAll(async () => {
  const user = await prisma.csld_csld_user.create({
    data: { email, password: '', role: 1, name: 'Email Login Fixture', is_author: false },
  });
  userId = user.id;
});

afterAll(async () => {
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, stamp));
});

async function lastLogin(): Promise<Date | null> {
  const row = await prisma.csld_csld_user.findUnique({
    where: { id: userId },
    select: { last_login: true },
  });
  return row?.last_login ?? null;
}

async function mintToken(): Promise<string> {
  const auth = await prisma.csld_email_authentication.create({
    data: { user_id: userId, auth_token: `token-${stamp}-${Math.random().toString(36).slice(2)}` },
  });
  return auth.auth_token;
}

function buildApp() {
  const app = express();
  let loggedInUserId: number | null = null;
  app.use(
    '/auth/email-login',
    createEmailLoginRouter({
      prisma,
      login: async (_req, user) => {
        loggedInUserId = user.id;
      },
    }),
  );
  return { app, loggedInUserId: () => loggedInUserId };
}

describe('GET /auth/email-login', () => {
  it('logs the account in and records last_login on a valid token', async () => {
    expect(await lastLogin()).toBeNull();
    const token = await mintToken();
    const { app, loggedInUserId } = buildApp();

    const res = await request(app).get(`/auth/email-login?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(loggedInUserId()).toBe(userId);

    const stampedAt = await lastLogin();
    expect(stampedAt).not.toBeNull();
    // Sanity: the stamp is "now", not some fixture leftover.
    expect(Math.abs(Date.now() - stampedAt!.getTime())).toBeLessThan(60_000);

    // The token is single-use: it was consumed by the login.
    const consumed = await prisma.csld_email_authentication.findFirst({
      where: { auth_token: token },
    });
    expect(consumed).toBeNull();
  });

  it('redirects without touching last_login when the token is unknown', async () => {
    const before = await lastLogin();
    const { app, loggedInUserId } = buildApp();

    const res = await request(app).get('/auth/email-login?token=no-such-token');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/signIn?error=invalid_token');
    expect(loggedInUserId()).toBeNull();
    expect(await lastLogin()).toEqual(before);
  });

  it('redirects without a session when the token parameter is missing', async () => {
    const { app, loggedInUserId } = buildApp();

    const res = await request(app).get('/auth/email-login');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/signIn?error=invalid_token');
    expect(loggedInUserId()).toBeNull();
  });

  it('rejects an expired token and deletes it, leaving last_login alone', async () => {
    const before = await lastLogin();
    const token = await mintToken();
    // Age the token past the 15-minute window.
    await prisma.csld_email_authentication.updateMany({
      where: { auth_token: token },
      data: { created_at: new Date(Date.now() - 16 * 60 * 1000) },
    });
    const { app, loggedInUserId } = buildApp();

    const res = await request(app).get(`/auth/email-login?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/signIn?error=expired_token');
    expect(loggedInUserId()).toBeNull();
    expect(await lastLogin()).toEqual(before);
    const consumed = await prisma.csld_email_authentication.findFirst({
      where: { auth_token: token },
    });
    expect(consumed).toBeNull();
  });
});
