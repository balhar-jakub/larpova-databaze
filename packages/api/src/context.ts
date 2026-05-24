import { PrismaClient } from '@prisma/client';
import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { config } from 'dotenv';
import type { AuthUser } from '../auth/appUsers.js';
import { getFileService } from './files/index.js';
import type { FileService } from './files/fileService.js';

// Load .env from the api package directory
config({ path: new URL('../.env', import.meta.url).pathname });

const dbUrl = process.env.DATABASE_URL || '';
const sslUrl = dbUrl.includes('?') ? `${dbUrl}&sslmode=require` : `${dbUrl}?sslmode=require`;
console.log('Database URL configured');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: sslUrl,
    },
  },
});

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
    user: (req as any).user ?? null,
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
