import { describe, expect, it, vi } from 'vitest';
import { StorefrontService } from './storefront.service.js';

describe('StorefrontService catalogue & author rooms', () => {
  const mockDb = {
    query: vi.fn(),
  };
  const service = new StorefrontService(mockDb as any);

  it('fetches catalogue with superadmin books pinned first', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { id: '1', title: 'Admin Book', is_superadmin_book: true, price_kes: '1000' },
        { id: '2', title: 'Author Book', is_superadmin_book: false, price_kes: '500' },
      ],
    });

    const books = await service.getCatalogue();
    expect(books).toHaveLength(2);
    expect(books[0].is_superadmin_book).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY b.is_superadmin_book DESC, b.live_at DESC'),
      expect.any(Array),
    );
  });

  it('locks author room when author has fewer than 2 live books', async () => {
    // Author found with room_unlocked = false
    mockDb.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'author-1', full_name: 'Jane Doe', room_slug: 'jane-doe', room_unlocked: false }],
    });
    // Live book count = 1
    mockDb.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ count: '1' }],
    });

    await expect(service.getAuthorRoom('jane-doe')).rejects.toThrow('currently locked');
  });

  it('unlocks author room when author has 2 or more live books', async () => {
    mockDb.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'author-1', full_name: 'Jane Doe', room_slug: 'jane-doe', room_unlocked: true }],
    });
    mockDb.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ count: '2' }],
    });
    // Own books
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 'b1', title: 'Book 1' }, { id: 'b2', title: 'Book 2' }],
    });
    // Superadmin pinned books
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 'pin-1', title: 'Spotlight' }],
    });

    const room = await service.getAuthorRoom('jane-doe');
    expect(room.author.full_name).toBe('Jane Doe');
    expect(room.books).toHaveLength(2);
    expect(room.pinned_books).toHaveLength(1);
  });
});
