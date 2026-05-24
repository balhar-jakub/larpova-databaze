import { PrismaClient } from '@prisma/client';
import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { config } from 'dotenv';
import type { AuthUser } from '../auth/appUsers.js';
import { getFileService } from './files/index.js';
import type { FileService } from './files/fileService.js';

// Load .env from the api package directory
config({ path: new URL('../.env', import.meta.url).pathname });

// Ensure DATABASE_URL has SSL for RDS connections
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + '?sslmode=require';
  console.log('SSL added to DATABASE_URL');
}

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
