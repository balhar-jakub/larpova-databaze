import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

// ── File naming (matches Java AbstractUploadedFile.filePath()) ──

const PREVIEW_POSTFIX = '-p';

export function generateFilePath(clientFileName: string): string {
  const ext = getExtension(clientFileName);
  const name = crypto.randomBytes(8).toString('hex'); // 16 hex chars = same length as Java
  const dir = `${name[0]}/${name[1]}`;
  return `${dir}/${name}.${ext}`;
}

export function getPreviewPath(relativePath: string): string {
  const dot = relativePath.lastIndexOf('.');
  if (dot > 0) {
    return relativePath.substring(0, dot) + PREVIEW_POSTFIX + relativePath.substring(dot);
  }
  return relativePath + PREVIEW_POSTFIX;
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot > 0) return fileName.substring(dot + 1).toLowerCase();
  return 'jpg';
}

// ── UploadedFile abstraction ─────────────────────────────

export interface UploadedFile {
  /** Client-supplied file name (used for extension detection) */
  fileName: string;
  /** Base64-encoded file contents (from GraphQL UploadedFileInput) */
  contents: string;
  /** Decoded binary buffer */
  buffer(): Buffer;
}

export class Base64UploadedFile implements UploadedFile {
  constructor(
    public fileName: string,
    public contents: string,
  ) {}

  buffer(): Buffer {
    return Buffer.from(this.contents, 'base64');
  }
}

// ── LocalFiles service ───────────────────────────────────

export interface FileService {
  getFileStream(relativePath: string): Promise<Readable>;
  saveImageAndReturnPath(upload: UploadedFile, strategy: ResizeStrategy): Promise<SaveResult>;
  saveImageWithPreviewAndReturnPath(upload: UploadedFile, fullStrategy: ResizeStrategy, previewStrategy: ResizeStrategy | null): Promise<SaveResult>;
  saveFileAndReturnPath(upload: UploadedFile): Promise<string>;
  removeFiles(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}

export interface SaveResult {
  path: string;
  width: number;
  height: number;
}

export interface ResizeStrategy {
  (buffer: Buffer): Promise<Buffer>;
  outputWidth?: number;
  outputHeight?: number;
}

export class LocalFiles implements FileService {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private fullPath(relative: string): string {
    return join(this.dataDir, relative);
  }

  async getFileStream(relativePath: string): Promise<Readable> {
    return createReadStream(this.fullPath(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await access(this.fullPath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async saveImageAndReturnPath(upload: UploadedFile, strategy: ResizeStrategy): Promise<SaveResult> {
    return this.saveImageWithPreviewAndReturnPath(upload, strategy, null);
  }

  async saveImageWithPreviewAndReturnPath(
    upload: UploadedFile,
    fullStrategy: ResizeStrategy,
    previewStrategy: ResizeStrategy | null,
  ): Promise<SaveResult> {
    const path = generateFilePath(upload.fileName);
    const fullPath = this.fullPath(path);
    const sourceBuffer = upload.buffer();

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    // Save full image
    const fullBuffer = await fullStrategy(sourceBuffer);
    await this.writeBuffer(fullPath, fullBuffer);

    // Save preview
    if (previewStrategy) {
      const previewPath = this.fullPath(getPreviewPath(path));
      await mkdir(dirname(previewPath), { recursive: true });
      const previewBuffer = await previewStrategy(sourceBuffer);
      await this.writeBuffer(previewPath, previewBuffer);
    }

    return { path, width: fullStrategy.outputWidth ?? 0, height: fullStrategy.outputHeight ?? 0 };
  }

  async saveFileAndReturnPath(upload: UploadedFile): Promise<string> {
    const path = generateFilePath(upload.fileName);
    const fullPath = this.fullPath(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await this.writeBuffer(fullPath, upload.buffer());
    return path;
  }

  async removeFiles(relativePath: string): Promise<void> {
    try { await unlink(this.fullPath(relativePath)); } catch {}
    try { await unlink(this.fullPath(getPreviewPath(relativePath))); } catch {}
  }

  private async writeBuffer(filePath: string, buffer: Buffer): Promise<void> {
    const writer = createWriteStream(filePath);
    const { Readable } = await import('node:stream');
    await pipeline(Readable.from(buffer), writer);
  }
}
