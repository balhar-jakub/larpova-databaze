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
import { LocalFiles } from './src/api/src/files/fileService.js';
import { setFileService } from './src/api/src/files/index.js';
import { generateIcal } from './src/api/src/external/ical.js';

// ── Env setup ───────────────────────────────────────────

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
  const relativePath = req.params[0] as string;
  if (!relativePath || relativePath.includes('..')) return res.status(400).end();
  try {
    const stream = await fileService.getFileStream(relativePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch { res.status(404).end(); }
});

app.get('/ical', async (req, res) => {
  const id = req.query.id as string | undefined;
  let userId: number | undefined;
  if (id && id !== 'all') { userId = parseInt(id, 10); if (isNaN(userId)) userId = undefined; }
  try {
    const cal = await generateIcal(prisma, userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(cal);
  } catch { res.status(500).end(); }
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
