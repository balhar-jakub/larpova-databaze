import { generateFilePath, getPreviewPath, Base64UploadedFile } from '../files/fileService';
import { getCoverImageStrategy, getCuttingSquareStrategy, getMaxWidthHeightStrategy } from '../files/imageStrategies';
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
