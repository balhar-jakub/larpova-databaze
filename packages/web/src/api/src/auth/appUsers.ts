import type { Context } from '../context.js';

export enum CsldRole {
  ANONYMOUS = 0,
  USER = 1,
  EDITOR = 2,
  ADMIN = 3,
  AUTHOR = 4,
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  nickname: string | null;
  role: number;
  image: { id: number; path: string | null } | null;
  amountOfComments: number | null;
  amountOfPlayed: number | null;
  amountOfCreated: number | null;
}

export function isSignedIn(ctx: Context): ctx is Context & { user: AuthUser } {
  return ctx.user !== null;
}

export function isEditor(ctx: Context): boolean {
  if (!ctx.user) return false;
  return ctx.user.role === CsldRole.EDITOR || ctx.user.role === CsldRole.ADMIN;
}

export function isAdmin(ctx: Context): boolean {
  if (!ctx.user) return false;
  return ctx.user.role === CsldRole.ADMIN;
}

/**
 * At least editor level (EDITOR or ADMIN).
 * NOTE: AUTHOR (role=4) is NOT included — authors are community
 * contributors, not staff. Numerically AUTHOR > ADMIN but the
 * check must be explicit.
 */
export function isAtLeastEditor(ctx: Context): boolean {
  if (!ctx.user) return false;
  return ctx.user.role === CsldRole.EDITOR || ctx.user.role === CsldRole.ADMIN;
}

/**
 * isAdminOfGroup: role > USER (excludes ANONYMOUS=0 and USER=1).
 * Matches Java `role > CsldRoles.USER.getRole()`.
 */
export function isAdminOfGroup(ctx: Context): boolean {
  if (!ctx.user) return false;
  return ctx.user.role > CsldRole.USER;
}
