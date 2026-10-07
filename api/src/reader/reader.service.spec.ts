import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReaderService } from './reader.service.js';

describe('ReaderService', () => {
  let service: ReaderService;
  let mockDb: any;
  let mockDrm: any;
  let mockStorage: any;
  let mockCrypto: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    mockDrm = {
      decryptBookFile: vi.fn(),
    };
    mockStorage = {
      getFile: vi.fn(),
    };
    mockCrypto = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    };
    service = new ReaderService(mockDb, mockDrm, mockStorage, mockCrypto);
  });

  it('should deliver DRM reader session and enforce watermarking structure', async () => {
    mockDb.query
      // Book and licence fetch
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'book-1',
            title: 'Nairobi Nights',
            subtitle: 'A Modern Tale',
            slug: 'nairobi-nights',
            file_format: 'epub',
            encrypted_object_key: null,
            key_ref: null,
            description: 'A brilliant story.',
            author_name: 'John Author',
            publisher_name: null,
            licence_id: 'lic-12345678',
            max_devices: 3,
            issued_at: new Date().toISOString(),
            buyer_name: 'Smith Brock',
            buyer_email: 'smith@example.com',
            buyer_phone: '0712345678',
          },
        ],
      })
      // Device registration
      .mockResolvedValueOnce({
        rows: [{ id: 'dev-1' }],
      })
      // Licence device insertion
      .mockResolvedValueOnce({
        rows: [],
      })
      // Active device count
      .mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

    const session = await service.getReaderSession('user-1', 'book-1', 'fingerprint-abc', 'Chrome Desktop');

    expect(session.book.title).toBe('Nairobi Nights');
    expect(session.licence.active_devices).toBe(1);
    expect(session.watermark.buyer_name).toBe('Smith Brock');
    expect(session.watermark.display_text).toContain('Smith Brock');
    expect(session.content.chapters?.length).toBeGreaterThan(0);
  });
});
