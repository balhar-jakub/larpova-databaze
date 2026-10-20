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
  /** Short public bio (`csld_csld_user.description`). */
  description: string | null;
  /** `csld_csld_user.gender`: 0 unspecified, 1 male, 2 female. */
  gender?: number | null;
  role: number;
  image: { id: number; path: string | null } | null;
  amountOfComments: number | null;
  amountOfPlayed: number | null;
  amountOfCreated: number | null;
}

export function isSignedIn(ctx: Context): ctx is Context & { user: AuthUser } {
  return ctx.user !== null;
}

/** The row shape every session path loads (`findUnique` + `include: { csld_image: true }`). */
export interface SessionUserRow {
  id: number;
  email?: string | null;
  name: string | null;
  nickname: string | null;
  description?: string | null;
  gender?: number | null;
  role: number;
  csld_image?: { id: number; path: string | null } | null;
  amount_of_comments: number | null;
  amount_of_played: number | null;
  amount_of_created: number | null;
}

/**
 * The single place a database row becomes a session user.
 *
 * There used to be four hand-built copies (deserialize hook, remember-me
 * middleware, the magic-link callback, the OAuth callback); they drifted, and all
 * of them once omitted the required `description`. One mapper, so the next field
 * added to `AuthUser` cannot go missing in three of four places.
 */
export function toAuthUser(row: SessionUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email ?? '',
    name: row.name,
    nickname: row.nickname,
    description: row.description ?? null,
    gender: row.gender ?? null,
    role: row.role,
    image: row.csld_image ? { id: row.csld_image.id, path: row.csld_image.path } : null,
    amountOfComments: row.amount_of_comments,
    amountOfPlayed: row.amount_of_played,
    amountOfCreated: row.amount_of_created,
  };
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
