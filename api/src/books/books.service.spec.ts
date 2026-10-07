import { describe, expect, it, vi } from 'vitest';
import { BooksService } from './books.service.js';
import type { UploadedFile } from './books.types.js';

describe('BooksService file validation & slugging', () => {
  const mockDb = {
    query: vi.fn(),
  };
  const mockStorage = {
    saveRaw: vi.fn().mockResolvedValue('raw/test.pdf'),
    saveEncrypted: vi.fn().mockResolvedValue('encrypted/test.enc'),
    saveCover: vi.fn().mockResolvedValue('covers/cover.jpg'),
    getFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  };
  const mockScanner = {
    scanBuffer: vi.fn().mockResolvedValue({ isInfected: false }),
  };
  const mockDrm = {
    processBookDrm: vi.fn().mockResolvedValue({
      encryptedObjectKey: 'encrypted/test.enc',
      keyRef: 'mock-key-ref',
      sha256: 'mock-sha',
      sizeBytes: 100,
    }),
  };

  const service = new BooksService(
    mockDb as any,
    mockStorage as any,
    mockScanner as any,
    mockDrm as any,
  );

  it('rejects unsupported file formats', async () => {
    const invalidFile: UploadedFile = {
      originalname: 'malicious.exe',
      mimetype: 'application/x-msdownload',
      size: 1024,
      buffer: Buffer.from('data'),
    };

    await expect(
      service.createAuthorBook('author-id', { title: 'Test Book', language: 'en', price_kes: 500 }, invalidFile),
    ).rejects.toThrow('Unsupported file format');
  });

  it('rejects files larger than 50MB', async () => {
    const oversizedFile: UploadedFile = {
      originalname: 'huge.pdf',
      mimetype: 'application/pdf',
      size: 51 * 1024 * 1024,
      buffer: Buffer.alloc(10),
    };

    await expect(
      service.createAuthorBook('author-id', { title: 'Test Book', language: 'en', price_kes: 500 }, oversizedFile),
    ).rejects.toThrow('exceeds maximum 50MB limit');
  });

  it('blocks malware infected files from being processed', async () => {
    const virusFile: UploadedFile = {
      originalname: 'virus.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'),
    };

    mockScanner.scanBuffer.mockResolvedValueOnce({
      isInfected: true,
      virusName: 'EICAR-Test-Signature',
    });

    await expect(
      service.createAuthorBook('author-id', { title: 'Test Book', language: 'en', price_kes: 500 }, virusFile),
    ).rejects.toThrow('Malware detected');
  });
});
