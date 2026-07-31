import { generateFilePath, getPreviewPath, Base64UploadedFile, LocalFiles } from '../files/fileService';
import { getCoverImageStrategy, getCuttingSquareStrategy, getMaxWidthHeightStrategy } from '../files/imageStrategies';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import sharp from 'sharp';

describe('File naming', () => {
  it('generates path with subdirectory structure', () => {
    const path = generateFilePath('photo.jpg');
    // Format: {char0}/{char1}/{16hex}.jpg
    expect(path).toMatch(/^[0-9a-f]\/[0-9a-f]\/[0-9a-f]{16}\.jpg$/);
  });

  it('extracts extension from client filename', () => {
    const path = generateFilePath('my-file.PNG');
    expect(path).toMatch(/\.png$/);
  });

  it('defaults to jpg for unknown extensions', () => {
    const path = generateFilePath('noext');
    expect(path).toMatch(/\.jpg$/);
  });
});

describe('Preview path generation', () => {
  it('adds -p infix before extension', () => {
    expect(getPreviewPath('a/b/abcd1234.jpg')).toBe('a/b/abcd1234-p.jpg');
  });

  it('handles no extension', () => {
    expect(getPreviewPath('a/b/file')).toBe('a/b/file-p');
  });

  it('handles multiple dots', () => {
    expect(getPreviewPath('a/b/file.name.jpg')).toBe('a/b/file.name-p.jpg');
  });
});

describe('Base64UploadedFile', () => {
  it('decodes base64 contents', () => {
    const file = new Base64UploadedFile('test.txt', Buffer.from('hello').toString('base64'));
    expect(file.buffer().toString()).toBe('hello');
  });
});

describe('Image strategies', () => {
  // Create a 100x100 test image
  async function testImage(w: number, h: number): Promise<Buffer> {
    return sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .png().toBuffer();
  }

  describe('getMaxWidthHeightStrategy', () => {
    it('scales down to fit max dimensions', async () => {
      const img = await testImage(200, 100);
      const strategy = getMaxWidthHeightStrategy(100, 50);
      const result = await strategy(img);
      const meta = await sharp(result).metadata();
      expect(meta.width!).toBeLessThanOrEqual(100);
      expect(meta.height!).toBeLessThanOrEqual(50);
    });

    it('does not upscale', async () => {
      const img = await testImage(10, 10);
      const strategy = getMaxWidthHeightStrategy(100, 100);
      const result = await strategy(img);
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(10);
      expect(meta.height).toBe(10);
    });
  });

  describe('getCuttingSquareStrategy', () => {
    it('produces square output at correct size', async () => {
      const img = await testImage(200, 100);
      const strategy = getCuttingSquareStrategy(50, 10);
      const result = await strategy(img);
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(50);
      expect(meta.height).toBe(50);
    });
  });

  describe('getCoverImageStrategy', () => {
    it('returns wide image as-is', async () => {
      const img = await testImage(1000, 200); // 5:1 > 10:3
      const strategy = getCoverImageStrategy();
      const result = await strategy(img);
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(1000);
      expect(meta.height).toBe(200);
    });

    it('crops height for narrow images', async () => {
      const img = await testImage(100, 100); // 1:1 < 10:3
      const strategy = getCoverImageStrategy();
      const result = await strategy(img);
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(100);
      expect(meta.height).toBe(30); // 100 / (10/3) = 30
    });
  });
});

describe('LocalFiles.streamToResponse', () => {
  let tmpDir: string;
  let files: LocalFiles;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'csld-files-test-'));
    files = new LocalFiles(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Mock Express response — EventEmitter-based, so stream.pipe() can attach listeners. */
  function mockRes() {
    const ee = new EventEmitter();
    ee.setMaxListeners(50);
    const state: { status?: number; ended: boolean; destroyed: boolean; bytes: number } = {
      ended: false,
      destroyed: false,
      bytes: 0,
    };
    const headers: Record<string, string> = {};
    const res: any = ee;
    res.headersSent = false;
    res.writableEnded = false;
    res.setHeader = (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
      res.headersSent = true;
    };
    res.getHeader = (k: string) => headers[k.toLowerCase()];
    res.status = (s: number) => { state.status = s; return res; };
    res.end = (data?: any) => {
      if (state.ended) return res;
      if (data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
        state.bytes += buf.length;
      }
      state.ended = true;
      res.writableEnded = true;
      // Emit 'finish' then 'close' so Node's pipe machinery cleans up.
      res.emit('finish');
      res.emit('close');
      return res;
    };
    res.destroy = (err?: Error) => {
      if (state.destroyed) return res;
      state.destroyed = true;
      if (err) res.emit('error', err);
      res.emit('close');
      return res;
    };
    // Mock pipe target — accept writes so stream.pipe() doesn't backpressure forever.
    res.write = (chunk: any, _enc?: any, cb?: any) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      state.bytes += buf.length;
      if (typeof cb === 'function') cb();
      return true;
    };
    return { res, state, headers };
  }

  it('streams an existing file to the response', async () => {
    const payload = Buffer.from('hello world');
    writeFileSync(join(tmpDir, 'present.txt'), payload);
    const { res, state } = mockRes();
    // Suppress uncaught warnings — streamToResponse listens on res 'close' for cleanup.
    res.on('error', () => {});

    const ok = await files.streamToResponse('present.txt', res);
    // Wait for the pipe to drain to the mock writable.
    await new Promise<void>((resolve) => {
      if (state.ended) return resolve();
      res.once('finish', () => resolve());
      res.once('close', () => resolve());
    });

    expect(ok).toBe(true);
    expect(state.bytes).toBe(payload.length);
    expect(state.status).toBeUndefined(); // default 200, no explicit status() call
  });

  it('returns 404 immediately when file is missing (does NOT hang)', async () => {
    const { res, state } = mockRes();

    const ok = await files.streamToResponse('does-not-exist.txt', res);

    expect(ok).toBe(false);
    expect(state.status).toBe(404);
    expect(state.ended).toBe(true);
  });

  it('handles client disconnect mid-stream without crashing', async () => {
    // 1 MB file to ensure streaming
    const big = Buffer.alloc(1024 * 1024, 0x41);
    writeFileSync(join(tmpDir, 'big.bin'), big);
    const { res } = mockRes();
    // Simulate Express semantics: when the client disconnects, the res emits
    // 'close' but NOT 'error'. destroy() should not throw.
    res.on('error', () => {}); // silence uncaught listener noise if anything slips through

    const ok = await files.streamToResponse('big.bin', res);
    res.destroy();
    await new Promise((r) => setImmediate(r));

    expect(ok).toBe(true);
    // The key assertion: this resolves and doesn't throw. Before the fix,
    // missing files caused the process to crash with an unhandled 'error'
    // event from createReadStream.
  });
});
