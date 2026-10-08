import type { Context } from '../context.js';
import { validatePassword, generatePbkdf2Hash } from '../auth/password.js';
import type { AuthUser } from '../auth/appUsers.js';
import { setRememberMeCookie, clearRememberMeCookie } from '../auth/rememberMe.js';
import { GraphQLError } from 'graphql';
import crypto from 'node:crypto';
import { verifyRecaptcha } from '../external/recaptcha.js';
import { normalizeGender, genderToNumber } from './mappers.js';
import { sendPasswordResetEmail } from '../external/email.js';
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

  const row = await ctx.db.csld_csld_user.findUnique({
    where: { email: userName.toLowerCase() },
    include: { csld_image: true },
  });

  if (!row) {
    throw new GraphQLError('Invalid email or password', {
      extensions: { code: 'AUTHENTICATION_FAILED' },
    });
  }

  if (!validatePassword(password, row.password)) {
    throw new GraphQLError('Invalid email or password', {
      extensions: { code: 'AUTHENTICATION_FAILED' },
    });
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
  name: string;
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

  if (!input.email || !input.password || !input.name) {
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

  // Check if email already exists
  const existing = await ctx.db.csld_csld_user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    throw new GraphQLError('Email already registered', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // Hash password with PBKDF2 using email as salt
  const passwordHash = generatePbkdf2Hash(input.password, input.email);

  // Store the optional profile picture before the account exists, so a broken
  // image fails the registration instead of leaving a user without a picture.
  const imageId = await saveProfilePicture(ctx, input.profilePicture);

  const row = await ctx.db.csld_csld_user.create({
    data: {
      email: input.email.toLowerCase(),
      password: passwordHash,
      name: input.name,
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

  const imageId = await saveProfilePicture(ctx, input.profilePicture);

  await ctx.db.csld_csld_user.update({
    where: { id: ctx.user.id },
    data: {
      email: input.email.toLowerCase(),
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
    },
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
  const user = await ctx.db.csld_csld_user.findUnique({
    where: { email: args.email.toLowerCase() },
  });

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
