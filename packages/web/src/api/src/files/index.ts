import type { FileService } from './fileService.js';

let _fileService: FileService | null = null;

export function setFileService(fs: FileService): void {
  _fileService = fs;
}

export function getFileService(): FileService {
  if (!_fileService) throw new Error('FileService not initialized');
  return _fileService;
}
