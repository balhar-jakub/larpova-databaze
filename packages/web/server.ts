// Combined server: Next.js + Apollo GraphQL API
// Serves frontend pages and the GraphQL endpoint from one Heroku dyno.
//
// Uses the API's existing code (imported from ../api/src/...)
// with Next.js 14 as the fallback page handler.

import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// API imports
import { PrismaClient } from '@prisma/client';
import pgSession from 'connect-pg-simple';
import passport from 'passport';
import { resolvers } from './src/api/src/resolvers/index.js';
import { configurePassport } from './src/api/src/auth/passport.js';
import { rememberMeMiddleware } from './src/api/src/auth/rememberMe.js';
import { setRememberMeCookie } from './src/api/src/auth/rememberMe.js';
import { LocalFiles } from './src/api/src/files/fileService.js';
import { setFileService } from './src/api/src/files/index.js';
import { generateIcal } from './src/api/src/external/ical.js';

// ── Env setup ───────────────────────────────────────────

// Mock browser globals for SSR (draft-js, html-to-draftjs, jss, etc.)
if (typeof window === 'undefined') {
  const noop = () => {};
  (global as any).window = {
    location: { protocol: 'https:', hostname: 'localhost', host: 'localhost', href: 'https://localhost/', },
    navigator: { userAgent: 'node.js' },
    addEventListener: noop,
  };
  const docEl = { childNodes: [], children: [] };
  (global as any).document = {
    createElement: (tag: string) => {
      const el: any = { style: {}, classList: null };
      // FontAwesome calls styleEl.setAttribute() during SSR
      if (tag === 'style') {
        el.setAttribute = noop;
        el.appendChild = noop;
        el.sheet = { cssRules: [], insertRule: noop };
      }
      return el;
    },
    createTextNode: () => ({}),
    getElementsByTagName: () => [],
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: noop,
    documentElement: docEl,
    body: docEl,
    head: docEl,
  };
  (global as any).HTMLElement = function() {} as any;
}

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// SSL for RDS
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode')) {
  process.env.DATABASE_URL += '?sslmode=require';
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Prisma + File service ───────────────────────────────

const prisma = new PrismaClient();
const dataDir = process.env.CSLD_DATA_DIR || '/tmp/csld-files';
const fileService = new LocalFiles(dataDir);
setFileService(fileService);

// ── Express + Auth middleware ────────────────────────────

const app = express();
app.use(cors());
app.use(cookieParser());

// Session store
const PgStore = pgSession(session);
const sessionMiddleware = session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  name: 'csld.sid',
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
});
app.use(sessionMiddleware);

// Passport
const passportInstance = configurePassport(prisma);
app.use(rememberMeMiddleware(prisma));
app.use(passportInstance.initialize());
app.use(passportInstance.session());
app.use(express.json({ limit: '10mb' }));

// ── GraphQL API ─────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, 'src', 'api', 'src', 'schema.graphql'), 'utf-8');

const apolloServer = new ApolloServer({ typeDefs, resolvers });
await apolloServer.start();

app.use('/graphql', expressMiddleware(apolloServer, {
  context: async ({ req, res }) => ({
    db: prisma,
    user: (req as any).user ?? null,
    req, res,
    files: fileService,
    login: (user: any) => new Promise<void>((resolve, reject) => {
      (req as any).login(user, (err: Error | null) => {
        if (err) reject(err); else resolve();
      });
    }),
    logout: () => new Promise<void>((resolve, reject) => {
      (req as any).logout((err: Error | null) => {
        if (err) reject(err); else resolve();
      });
    }),
  }),
}));

// ── REST endpoints ──────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/data/*', async (req, res) => {
  const relativePath: string = req.params[0];
  if (!relativePath || relativePath.includes('..')) return res.status(400).end();
  try {
    const stream = await fileService.getFileStream(relativePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch { res.status(404).end(); }
});

app.get('/ical', async (req, res) => {
    const id: string | undefined = req.query.id as string | undefined;
  let userId: number | undefined;
  if (id && id !== 'all') { userId = parseInt(id, 10); if (isNaN(userId)) userId = undefined; }
  try {
    const cal = await generateIcal(prisma, userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(cal);
  } catch { res.status(500).end(); }
});

// ── Image serving (resolves image IDs to file paths) ─────

app.get('/game-image/', async (req, res) => {
  const imageId = req.query.imageId as string;
  if (!imageId) return res.status(400).end();
  try {
    const img = await prisma.csld_image.findUnique({ where: { id: parseInt(imageId, 10) }, select: { path: true } });
    if (!img?.path) return res.status(404).end();
    const stream = await fileService.getFileStream(img.path);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch { res.status(404).end(); }
});

app.get('/user-icon', async (req, res) => {
  const imageId = req.query.imageId as string;
  if (!imageId) return res.status(404).end();
  try {
    const img = await prisma.csld_image.findUnique({ where: { id: parseInt(imageId, 10) }, select: { path: true } });
    if (!img?.path) return res.status(404).end();
    const stream = await fileService.getFileStream(img.path);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch { res.status(404).end(); }
});

// ── Email magic-link callback ────────────────────────────

app.get('/auth/email-login', async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.redirect('/signIn?error=invalid_token');

  try {
    // Find token (newest first)
    const auth = await prisma.csld_email_authentication.findFirst({
      where: { auth_token: token },
      include: { csld_csld_user: { include: { csld_image: true } } },
      orderBy: { id: 'desc' },
    });

    if (!auth || !auth.csld_csld_user) {
      return res.redirect('/signIn?error=invalid_token');
    }

    // Check token expiry (15 minutes)
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    if (Date.now() - auth.created_at.getTime() > FIFTEEN_MINUTES) {
      await prisma.csld_email_authentication.delete({ where: { id: auth.id } });
      return res.redirect('/signIn?error=expired_token');
    }

    const user = auth.csld_csld_user;
    const authUser = {
      id: user.id,
      email: user.email!,
      name: user.name,
      nickname: user.nickname,
      role: user.role,
      image: user.csld_image
        ? { id: user.csld_image.id, path: user.csld_image.path }
        : null,
      amountOfComments: user.amount_of_comments,
      amountOfPlayed: user.amount_of_played,
      amountOfCreated: user.amount_of_created,
    };

    // Log in via Passport
    await new Promise<void>((resolve, reject) => {
      (req as any).login(authUser, (err: Error | null) => {
        if (err) reject(err); else resolve();
      });
    });

    // Set remember-me cookie
    setRememberMeCookie(res, authUser.id);

    // Delete used token
    await prisma.csld_email_authentication.delete({
      where: { id: auth.id },
    });

    res.redirect('/');
  } catch (err) {
    console.error('Email login error:', err);
    res.redirect('/signIn?error=login_failed');
  }
});

// ── Next.js ─────────────────────────────────────────────

const nextApp = next({ dev, hostname: '0.0.0.0', port });
const nextHandler = nextApp.getRequestHandler();

await nextApp.prepare();

// Let Next.js handle all other routes (pages, static files, rewrites)
app.all('*', (req, res) => nextHandler(req, res));

// ── Start ───────────────────────────────────────────────

app.listen(port, () => {
  console.log(`CSLD app running at http://localhost:${port}`);
});
