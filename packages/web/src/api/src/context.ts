import { PrismaClient } from '@prisma/client';
import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { config } from 'dotenv';
import type { AuthUser } from '../auth/appUsers.js';
import { getFileService } from './files/index.js';
import type { FileService } from './files/fileService.js';

// Load .env from the api package directory
config({ path: new URL('../.env', import.meta.url).pathname });

export const prisma = new PrismaClient();

export interface Context {
  db: PrismaClient;
  user: AuthUser | null;
  req: ExpressContextFunctionArgument['req'];
  res: ExpressContextFunctionArgument['res'];
  login: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  files: FileService;
}

export async function createContext({ req, res }: ExpressContextFunctionArgument): Promise<Context> {
  return {
    db: prisma,
    // Read lazily: passport sets `req.user` on `ctx.login()`, and a resolver
    // that signs the caller in during the request (signup, login) has to see
    // that user — otherwise it answers with the email of "nobody".
    get user() {
      return (req as any).user ?? null;
    },
    req,
    res,
    files: getFileService(),
    login: (user: AuthUser) => {
      return new Promise<void>((resolve, reject) => {
        (req as any).login(user, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    logout: () => {
      return new Promise<void>((resolve, reject) => {
        (req as any).logout((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
