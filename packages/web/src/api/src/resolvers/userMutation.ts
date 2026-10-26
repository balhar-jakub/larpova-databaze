import type { Context } from '../context.js';
import { validatePassword, isLegacyMd5, generatePbkdf2Hash } from '../auth/password.js';
import { findUserByEmail, findUserCandidatesByEmail, normalizeEmail } from '../auth/emailLookup.js';
import type { AuthUser } from '../auth/appUsers.js';
import { setRememberMeCookie, clearRememberMeCookie } from '../auth/rememberMe.js';
import { GraphQLError } from 'graphql';
import crypto from 'node:crypto';
import { verifyRecaptcha } from '../external/recaptcha.js';
import { normalizeGender, genderToNumber } from './mappers.js';
import { sendPasswordResetEmail, sendMagicLinkEmail } from '../external/email.js';
import {
  saveProfilePicture,
  removeProfilePictureIfUnused,
  type ProfilePictureInput,
} from './profilePicture.js';

/** Structural ceiling for the profile bio — the settings form is far stricter. */
export const MAX_BIO_LENGTH = 20_000;

// ── Helpers ──────────────────────────────────────────────

function mapUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email!,
    name: row.name,
    nickname: row.nickname,
    description: row.description ?? null,
    role: row.role,
    gender: row.gender ?? null,
    image: row.csld_image ? { id: row.csld_image.id, path: row.csld_image.path } : null,
    amountOfComments: row.amount_of_comments,
    amountOfPlayed: row.amount_of_played,
    amountOfCreated: row.amount_of_created,
  };
}

function userToGraphQL(user: AuthUser) {
  return {
    id: String(user.id),
    name: user.name,
    nickname: user.nickname,
    email: user.email,
    role: ['ANONYMOUS', 'USER', 'EDITOR', 'ADMIN', 'AUTHOR'][user.role] || 'USER',
    gender: normalizeGender(user.gender),
    image: user.image,
    amountOfComments: user.amountOfComments,
    amountOfPlayed: user.amountOfPlayed,
    amountOfCreated: user.amountOfCreated,
    lastRating: null,
    description: user.description ?? null,
    birthDate: null,
    city: null,
    ratings: [],
    playedGames: [],
    wantedGames: [],
    authoredGames: [],
    commentsPaged: () => ({ comments: [], totalAmount: 0 }),
  };
}

// ── LogIn ────────────────────────────────────────────────

export async function logInResolver(
  _parent: unknown,
  args: { userName: string; password: string },
  ctx: Context,
) {
  const { userName, password } = args;

  if (ctx.user) {
    // Already logged in — return current user
    return userToGraphQL(ctx.user);
  }

  // Case-insensitive, because the column is not: 351 production rows store the
  // address with capitals (docs/navrh-normalizace-emailu.md). The password picks
  // the account when the address alone is ambiguous (the five duplicate pairs).
  const candidates = await findUserCandidatesByEmail(ctx.db, userName);

  const row = candidates.find((candidate) => validatePassword(password, candidate.password));

  if (!row) {
    throw new GraphQLError('Invalid email or password', {
      extensions: { code: 'AUTHENTICATION_FAILED' },
    });
  }

  if (candidates.length > 1) {
    console.warn(
      `[logIn] ${candidates.length} accounts match "${normalizeEmail(userName)}" ` +
        `(ids ${candidates.map((candidate) => candidate.id).join(', ')}); ` +
        `the password identified id ${row.id}.`,
    );
  }

  // Legacy MD5 → PBKDF2 upgrade, on a password that just validated. The upgrade
  // used to live only in passport.ts's local strategy, which nothing calls
  // (`passport.authenticate('local')` appears nowhere), so the 305 production
  // accounts that still hold an unsalted 32-hex MD5 hash had been stuck on it for
  // good. Credential-less rows (magic-link/OAuth, `password = ''`) never reach
  // this: `validatePassword` returns false for an empty stored hash, and neither
  // do the 141 synthetic accounts whose 13-character placeholder is not a digest
  // at all. A failure here must not fail the sign-in — the credential is valid
  // either way and the next login retries — so it is logged, not thrown.
  if (isLegacyMd5(row.password)) {
    try {
      await ctx.db.csld_csld_user.update({
        where: { id: row.id },
        data: { password: generatePbkdf2Hash(password, normalizeEmail(row.email ?? '')) },
      });
    } catch (err) {
      console.warn(`[logIn] MD5 → PBKDF2 upgrade failed for user ${row.id}:`, err);
    }
  }

  const user = mapUser(row);

  // Log the user in via Passport
  await ctx.login(user);

  // Set remember-me cookie
  setRememberMeCookie(ctx.res as any, user.id);

  return userToGraphQL(user);
}

// ── LogOut ───────────────────────────────────────────────

export async function logOutResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  if (ctx.user) {
    await ctx.logout();
    clearRememberMeCookie(ctx.res as any);
  }
  return null;
}

// ── CreateUser ───────────────────────────────────────────

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  nickname?: string;
  birthDate?: string;
  city?: string;
  gender?: string;
  recaptcha: string;
  profilePicture?: ProfilePictureInput;
}

export async function createUserResolver(
  _parent: unknown,
  args: { input: CreateUserInput },
  ctx: Context,
) {
  const { input } = args;

  if (!input.email || !input.password) {
    throw new GraphQLError('Missing required fields', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Verify reCAPTCHA
  const recaptchaOk = await verifyRecaptcha(input.recaptcha);
  if (!recaptchaOk) {
    throw new GraphQLError('reCAPTCHA verification failed', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Case-insensitive: a case variant of a registered address is the same account,
  // not a free address — this is the check that let sign-up create second accounts.
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(ctx.db, email);

  if (existing) {
    throw new GraphQLError('Email already registered', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Hash password with PBKDF2 using the address as salt (as stored, so the salt
  // keeps matching the column after the e-mail normalisation migration)
  const passwordHash = generatePbkdf2Hash(input.password, email);

  // Store the optional profile picture before the account exists, so a broken
  // image fails the registration instead of leaving a user without a picture.
  const imageId = await saveProfilePicture(ctx, input.profilePicture);

  const row = await ctx.db.csld_csld_user.create({
    data: {
      email,
      password: passwordHash,
      // Registration only asks for email + password; the display name is a
      // placeholder from the email the user can change in settings after
      // signing in (same fallback as startEmailLogin's auto-registration).
      name: input.name?.trim() || input.email.split('@')[0],
      nickname: input.nickname ?? null,
      birth_date: input.birthDate ? new Date(input.birthDate) : null,
      address: input.city ?? null,
      image: imageId,
      gender: genderToNumber(input.gender),
      role: 1, // USER
      is_author: false,
      amount_of_comments: 0,
      amount_of_played: 0,
      amount_of_created: 0,
    },
    include: { csld_image: true },
  });

  const user = mapUser(row);

  // Auto-login after registration
  await ctx.login(user);

  return userToGraphQL(user);
}

// ── UpdateLoggedInUser ───────────────────────────────────

/** The profile's updatable columns. Fields an older client does not send
 * (bio, gender, picture) are left untouched — spread-when-present keeps the
 * stored value instead of wiping it to null. */
function profileFieldData(input: {
  email: string;
  name: string;
  nickname?: string;
  birthDate?: string;
  city?: string;
  description?: string;
  gender?: string;
}, email: string, imageId: number | null) {
  return {
    email,
    name: input.name,
    nickname: input.nickname ?? null,
    birth_date: input.birthDate ? new Date(input.birthDate) : null,
    address: input.city ?? null,
    // A request that does not mention the bio (an older client) must not wipe
    // it, so the column is only touched when the field is actually sent.
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    // An absent gender means "keep the stored one" (older clients do not
    // send the field); an explicit UNSPECIFIED clears it.
    ...(input.gender ? { gender: genderToNumber(input.gender) } : {}),
    // No picture in this request means "keep the current one".
    ...(imageId ? { image: imageId } : {}),
  };
}

export async function updateLoggedInUserResolver(
  _parent: unknown,
  args: {
    input: {
      email: string;
      name: string;
      nickname?: string;
      birthDate?: string;
      city?: string;
      description?: string;
      gender?: string;
      profilePicture?: ProfilePictureInput;
    };
  },
  ctx: Context,
) {
  if (!ctx.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  }

  const { input } = args;

  // The bio is a short text; the form is the real gate, this is only the
  // structural ceiling so the column cannot be filled from a hand-written call.
  if (input.description && input.description.length > MAX_BIO_LENGTH) {
    throw new GraphQLError('Bio is too long', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  const previous = await ctx.db.csld_csld_user.findUnique({
    where: { id: ctx.user.id },
    select: { image: true },
  });

  // A case variant of somebody else's address is the same mailbox, and the
  // case-sensitive column would happily store it as a second account.
  const email = normalizeEmail(input.email);
  const takenBy = await findUserByEmail(ctx.db, email);
  if (takenBy && takenBy.id !== ctx.user.id) {
    throw new GraphQLError('Email already registered', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  const imageId = await saveProfilePicture(ctx, input.profilePicture);

  await ctx.db.csld_csld_user.update({
    where: { id: ctx.user.id },
    data: profileFieldData(input, email, imageId),
  });

  if (imageId && previous?.image) {
    await removeProfilePictureIfUnused(ctx, previous.image);
  }

  // Return updated user
  const row = await ctx.db.csld_csld_user.findUnique({
    where: { id: ctx.user.id },
    include: { csld_image: true },
  });

  return row ? userToGraphQL(mapUser(row)) : null;
}

// ── UpdateLoggedInUserPassword ───────────────────────────

export async function updateLoggedInUserPasswordResolver(
  _parent: unknown,
  args: { oldPassword: string; newPassword: string },
  ctx: Context,
) {
  if (!ctx.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  }

  const row = await ctx.db.csld_csld_user.findUnique({
    where: { id: ctx.user.id },
  });

  if (!row || !validatePassword(args.oldPassword, row.password)) {
    throw new GraphQLError('Invalid current password', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  const newHash = generatePbkdf2Hash(args.newPassword, ctx.user.email);

  await ctx.db.csld_csld_user.update({
    where: { id: ctx.user.id },
    data: { password: newHash },
  });

  return userToGraphQL(ctx.user);
}

// ── StartRecoverPassword ─────────────────────────────────

export async function startRecoverPasswordResolver(
  _parent: unknown,
  args: { email: string; recoverUrl: string },
  ctx: Context,
) {
  const user = await findUserByEmail(ctx.db, args.email);

  if (!user) return true; // Don't reveal if email exists

  // Generate reset token
  const token = crypto.randomBytes(32).toString('hex');

  // Save token (expires in 1 hour)
  await ctx.db.csld_email_authentication.create({
    data: {
      auth_token: token,
      user_id: user.id,
    },
  });

  // Send email
  const resetUrl = args.recoverUrl.replace(/\{token\}/g, token);
  await sendPasswordResetEmail(args.email, resetUrl).catch((err) => {
    console.error('Failed to send password reset email:', err);
  });

  return true;
}

// ── FinishRecoverPassword ────────────────────────────────

export async function finishRecoverPasswordResolver(
  _parent: unknown,
  args: { token: string; newPassword: string },
  ctx: Context,
) {
  const auth = await ctx.db.csld_email_authentication.findFirst({
    where: { auth_token: args.token },
    include: { csld_csld_user: true },
    orderBy: { id: 'desc' },
  });

  if (!auth || !auth.csld_csld_user) {
    throw new GraphQLError('Invalid or expired token', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Check token expiry (1 hour as stated in the email)
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - auth.created_at.getTime() > ONE_HOUR) {
    await ctx.db.csld_email_authentication.delete({
      where: { id: auth.id },
    });
    throw new GraphQLError('Token expired', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  const user = auth.csld_csld_user;
  const newHash = generatePbkdf2Hash(args.newPassword, user.email!);

  await ctx.db.csld_csld_user.update({
    where: { id: user.id },
    data: { password: newHash },
  });

  // Delete used token
  await ctx.db.csld_email_authentication.delete({
    where: { id: auth.id },
  });

  return userToGraphQL(mapUser(user));
}

// ── StartEmailLogin ─────────────────────────────────────

export async function startEmailLoginResolver(
  _parent: unknown,
  args: { email: string; loginUrlTemplate: string },
  ctx: Context,
) {
  const email = normalizeEmail(args.email);

  if (!email || !email.includes('@')) {
    throw new GraphQLError('Invalid email', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Find or create user — case-insensitively, so an existing account stored with
  // capitals is signed in instead of a second one being registered for it.
  let user = await findUserByEmail(ctx.db, email);

  if (!user) {
    // Auto-register — create user with placeholder name
    user = await ctx.db.csld_csld_user.create({
      include: { csld_image: true },
      data: {
        email,
        name: email.split('@')[0], // placeholder, user can update later
        password: '',              // no password for magic-link users
        role: 1,                   // USER
        is_author: false,
        amount_of_comments: 0,
        amount_of_played: 0,
        amount_of_created: 0,
      },
    });
  }

  // Generate one-time token
  const token = crypto.randomBytes(32).toString('hex');

  await ctx.db.csld_email_authentication.create({
    data: {
      auth_token: token,
      user_id: user.id,
    },
  });

  // Clean up expired tokens for this user (keep only the latest)
  const oldTokens = await ctx.db.csld_email_authentication.findMany({
    where: { user_id: user.id },
    orderBy: { id: 'desc' },
    skip: 1, // keep the one we just created
  });
  if (oldTokens.length > 0) {
    await ctx.db.csld_email_authentication.deleteMany({
      where: { id: { in: oldTokens.map(t => t.id) } },
    });
  }

  // Send email
  const loginUrl = args.loginUrlTemplate.replace('{token}', token);
  await sendMagicLinkEmail(email, loginUrl).catch((err) => {
    console.error('Failed to send magic link email:', err);
  });

  // Always return true — don't reveal whether email exists
  return true;
}
