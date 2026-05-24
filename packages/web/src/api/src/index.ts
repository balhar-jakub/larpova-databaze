import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import { resolvers } from './resolvers/index.js';
import { createContext, prisma } from './context.js';
import { configurePassport } from './auth/passport.js';
import { rememberMeMiddleware } from './auth/rememberMe.js';
import { LocalFiles } from './files/fileService.js';
import { setFileService } from './files/index.js';
import { generateIcal } from './external/ical.js';
import { syncEventToCalendar } from './external/googleCalendar.js';
import cron from 'node-cron';
import { runNightlyBatch } from './scheduled/tasks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

async function main() {
  const app = express();

  // ── Session store (PostgreSQL) ──────────────────────
  const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Create session table if it doesn't exist
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
  `);

  const PgStore = pgSession(session);
  const sessionStore = new PgStore({
    pool: pgPool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  });

  // ── Session middleware ───────────────────────────────
  const SESSION_SECRET = process.env.SESSION_SECRET || 'csld-dev-secret-change-in-production';

  app.use(
    session({
      store: sessionStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'csld.sid', // new session cookie name (Java used JSESSIONID)
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        sameSite: 'lax',
      },
    }),
  );

  // ── Passport ─────────────────────────────────────────
  const passport = configurePassport(prisma);

  // Remember-me cookie (runs before session auth)
  app.use(cookieParser());
  app.use(rememberMeMiddleware(prisma));

  app.use(passport.initialize());
  app.use(passport.session());

  // ── Apollo Server ────────────────────────────────────
  const server = new ApolloServer({ typeDefs, resolvers });

  await server.start();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── File Serving ────────────────────────────────────
  const dataDir = process.env.CSLD_DATA_DIR || '/tmp/csld-files';
  const fileService = new LocalFiles(dataDir);
  setFileService(fileService);
  console.log(`File service: local (${dataDir})`);

  app.get('/data/*', async (req, res) => {
    const relativePath = req.params[0] as string;
    if (!relativePath || relativePath.includes('..')) {
      return res.status(400).end();
    }
    try {
      const stream = await fileService.getFileStream(relativePath);
      const ext = relativePath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      };
      res.setHeader('Content-Type', mimeTypes[ext ?? ''] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      stream.pipe(res);
    } catch {
      res.status(404).end();
    }
  });

  // GraphQL endpoint
  app.use('/graphql', expressMiddleware(server, { context: createContext }));

  // ── Google Calendar webhook ──────────────────────────
  app.post('/cal-sync', async (req, res) => {
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceId = req.headers['x-goog-resource-id'] as string;
    console.log(`GCal webhook: channel=${channelId}, resource=${resourceId}`);

    // Google sends notifications when calendar events change.
    // Re-sync all events with gcaleventid to stay in sync.
    try {
      const events = await prisma.event.findMany({
        where: { gcaleventid: { not: null } },
      });
      for (const event of events) {
        await syncEventToCalendar(prisma, event.id).catch(() => {});
      }
    } catch (err) {
      console.error('GCal webhook sync error:', err);
    }

    res.status(200).end();
  });

  // ── iCal endpoint ────────────────────────────────────
  app.get('/ical', async (req, res) => {
    const id = req.query.id as string | undefined;
    let userId: number | undefined;
    if (id && id !== 'all') {
      userId = parseInt(id, 10);
      if (isNaN(userId)) userId = undefined;
    }
    try {
      const cal = await generateIcal(prisma, userId);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="csld-events.ics"');
      res.send(cal);
    } catch (err) {
      console.error('iCal generation error:', err);
      res.status(500).end();
    }
  });

  const port = parseInt(process.env.PORT || '8080', 10);
  app.listen(port, () => {
    console.log(`CSLD API running at http://localhost:${port}/graphql`);
  });

  // ── Scheduled Tasks ──────────────────────────────────
  // Nightly batch at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('Cron: starting nightly batch...');
    await runNightlyBatch(prisma);
  });

  // GCal subscription renewal every hour (not 60s — GCal webhook renewal is manual)
  if (process.env.GCAL_SYNC_URL) {
    cron.schedule('0 * * * *', async () => {
      console.log('Cron: GCal subscription check...');
      // Renew Google Calendar push notification channel
      // Placeholder — full implementation requires calendar.events.watch()
    });
  }

  console.log('Scheduled tasks registered (nightly at 02:00)');
}

main().catch(console.error);
