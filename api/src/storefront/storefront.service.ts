import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthorRoomDetails, StorefrontBookItem } from './storefront.types.js';

@Injectable()
export class StorefrontService {
  constructor(private readonly db: DatabaseService) {}

  async getCatalogue(search?: string, category?: string): Promise<StorefrontBookItem[]> {
    let query = `
      SELECT b.id, b.title, b.slug, b.subtitle, b.description, b.category,
             b.language, b.page_count, b.price_kes, b.is_superadmin_book,
             b.file_format, b.cover_object_key, b.live_at,
             u.id as author_id, u.full_name as author_name, u.room_slug as author_room_slug,
             p.full_name as publisher_name
      FROM books b
      JOIN users u ON u.id = b.author_id
      LEFT JOIN users p ON p.id = b.publisher_id
      WHERE b.status = 'live'
    `;
    const params: unknown[] = [];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND lower(b.category) = lower($${params.length})`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (b.title ILIKE $${params.length} OR b.description ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    // Canonical ordering: superadmin books pinned first, then newest live books
    query += ` ORDER BY b.is_superadmin_book DESC, b.live_at DESC`;

    const res = await this.db.query<StorefrontBookItem>(query, params);
    return res.rows;
  }

  async getAuthorRoom(slug: string): Promise<AuthorRoomDetails> {
    // 1. Find author
    const authorRes = await this.db.query<{
      id: string;
      full_name: string;
      bio: string | null;
      room_slug: string | null;
      room_unlocked: boolean;
    }>(
      `SELECT id, full_name, bio, room_slug, room_unlocked
       FROM users
       WHERE (lower(room_slug) = lower($1) OR lower(regexp_replace(full_name, '\\s+', '-', 'g')) = lower($1))
         AND role = 'author'`,
      [slug],
    );

    if (authorRes.rowCount === 0) {
      throw new NotFoundException('Author not found.');
    }

    const author = authorRes.rows[0];

    // Check unlock condition (2+ live books)
    const countRes = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM books WHERE author_id = $1 AND status = 'live'`,
      [author.id],
    );
    const liveCount = parseInt(countRes.rows[0]?.count || '0', 10);

    if (!author.room_unlocked && liveCount < 2) {
      throw new NotFoundException(
        'Author room is currently locked. Authors automatically unlock their public room when they have 2 or more live published books.',
      );
    }

    // 2. Author's own books
    const ownBooksRes = await this.db.query<StorefrontBookItem>(
      `SELECT b.id, b.title, b.slug, b.subtitle, b.description, b.category,
              b.language, b.page_count, b.price_kes, b.is_superadmin_book,
              b.file_format, b.cover_object_key, b.live_at,
              u.id as author_id, u.full_name as author_name, u.room_slug as author_room_slug,
              p.full_name as publisher_name
       FROM books b
       JOIN users u ON u.id = b.author_id
       LEFT JOIN users p ON p.id = b.publisher_id
       WHERE b.author_id = $1 AND b.status = 'live'
       ORDER BY b.live_at DESC`,
      [author.id],
    );

    // 3. Superadmin pinned books (§2.4: injected into every author room)
    const pinnedRes = await this.db.query<StorefrontBookItem>(
      `SELECT b.id, b.title, b.slug, b.subtitle, b.description, b.category,
              b.language, b.page_count, b.price_kes, b.is_superadmin_book,
              b.file_format, b.cover_object_key, b.live_at,
              u.id as author_id, u.full_name as author_name, u.room_slug as author_room_slug,
              p.full_name as publisher_name
       FROM books b
       JOIN users u ON u.id = b.author_id
       LEFT JOIN users p ON p.id = b.publisher_id
       WHERE b.is_superadmin_book = true AND b.status = 'live' AND b.author_id <> $1
       ORDER BY b.live_at DESC`,
      [author.id],
    );

    return {
      author: {
        id: author.id,
        full_name: author.full_name,
        bio: author.bio,
        room_slug: author.room_slug || slug,
      },
      books: ownBooksRes.rows,
      pinned_books: pinnedRes.rows,
    };
  }

  async getBookDetails(slug: string): Promise<StorefrontBookItem> {
    const res = await this.db.query<StorefrontBookItem>(
      `SELECT b.id, b.title, b.slug, b.subtitle, b.description, b.category,
              b.language, b.page_count, b.price_kes, b.is_superadmin_book,
              b.file_format, b.cover_object_key, b.live_at,
              u.id as author_id, u.full_name as author_name, u.room_slug as author_room_slug,
              p.full_name as publisher_name
       FROM books b
       JOIN users u ON u.id = b.author_id
       LEFT JOIN users p ON p.id = b.publisher_id
       WHERE b.slug = $1 AND b.status = 'live'`,
      [slug],
    );

    if (res.rowCount === 0) throw new NotFoundException('Book not found.');
    return res.rows[0];
  }
}
