import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';
import { Base64UploadedFile } from '../files/fileService.js';
import { getCuttingSquareStrategy } from '../files/imageStrategies.js';

/**
 * Storing of user profile pictures.
 *
 * Both the signup form and the settings form have always sent
 * `profilePicture: UploadedFileInput` and the resolvers silently ignored it, so
 * an upload looked successful (mutation returns, toast shows, page navigates)
 * while nothing was written. Everything a picture needs lives here.
 *
 * The geometry mirrors the legacy Java app: square crop at 120x120, cut 10%
 * from the top/left, which is what `getCuttingSquareStrategy` was written for.
 */

export const PROFILE_PICTURE_SIZE = 120;
export const PROFILE_PICTURE_CROP_PERCENT = 10;

/** The form limits the file to 2 MB — enforce the same limit server-side. */
export const MAX_PROFILE_PICTURE_BYTES = 2_000_000;

export interface ProfilePictureInput {
  /** Client file name, used for the extension */
  fileName: string;
  /** Base64-encoded contents */
  contents: string;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

function contentTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

function validationError(message: string) {
  return new GraphQLError(message, { extensions: { code: 'VALIDATION_FAILED' } });
}

/**
 * Resize/crop an uploaded picture, write it and record it in `csld_image`.
 * Returns the id of the new image row, or null when no picture was sent.
 */
export async function saveProfilePicture(
  ctx: Context,
  picture: ProfilePictureInput | null | undefined,
): Promise<number | null> {
  if (!picture) return null;

  if (!picture.fileName || !picture.contents) {
    throw validationError('Profile picture is missing the file name or contents');
  }

  // A base64 string of MAX_PROFILE_PICTURE_BYTES is ~4/3 as long; reject early so
  // an oversized payload never reaches sharp.
  if (picture.contents.length > MAX_PROFILE_PICTURE_BYTES * 1.4) {
    throw validationError('Profile picture is too large (max 2 MB)');
  }

  if (!ctx.files) {
    throw new GraphQLError('File storage is not available', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }

  const upload = new Base64UploadedFile(picture.fileName, picture.contents);
  const decoded = upload.buffer();

  if (decoded.length === 0) {
    throw validationError('Profile picture is empty');
  }
  if (decoded.length > MAX_PROFILE_PICTURE_BYTES) {
    throw validationError('Profile picture is too large (max 2 MB)');
  }

  let result;
  try {
    result = await ctx.files.saveImageAndReturnPath(
      upload,
      getCuttingSquareStrategy(PROFILE_PICTURE_SIZE, PROFILE_PICTURE_CROP_PERCENT),
    );
  } catch {
    // sharp throws on anything it cannot decode
    throw validationError('Profile picture is not a readable image');
  }

  const image = await ctx.db.csld_image.create({
    data: {
      path: result.path,
      contenttype: contentTypeFor(picture.fileName),
    },
  });

  return image.id;
}

/**
 * Drop a no longer used picture (row + file).
 *
 * Image rows are shared — many accounts use the same `upload/author_icon.png` —
 * so only an image nothing else points at may be deleted. The legacy data keeps
 * orphans; being careful is cheaper than breaking somebody else's avatar.
 */
export async function removeProfilePictureIfUnused(ctx: Context, imageId: number | null): Promise<void> {
  if (!imageId) return;

  try {
    const [users, groups, gameImages, coverImages, photos] = await Promise.all([
      ctx.db.csld_csld_user.count({ where: { image: imageId } }),
      ctx.db.csld_csld_group.count({ where: { image: imageId } }),
      ctx.db.csld_game.count({ where: { image: imageId } }),
      ctx.db.csld_game.count({ where: { cover_image: imageId } }),
      ctx.db.csld_photo.count({ where: { image: imageId } }),
    ]);

    if (users + groups + gameImages + coverImages + photos > 0) return;

    const image = await ctx.db.csld_image.findUnique({
      where: { id: imageId },
      select: { path: true },
    });

    await ctx.db.csld_image.delete({ where: { id: imageId } });
    if (image?.path && ctx.files) {
      await ctx.files.removeFiles(image.path);
    }
  } catch (err) {
    // Replacing a picture must not fail because the old one could not be removed.
    console.error('Failed to remove the previous profile picture:', err);
  }
}
