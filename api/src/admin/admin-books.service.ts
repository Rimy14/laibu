import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { BookRow, BookStatus } from '../books/books.types.js';

export interface AdminBookListItem extends BookRow {
  author_name: string;
  author_email: string;
}

@Injectable()
export class AdminBooksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async listBooks(status?: BookStatus): Promise<AdminBookListItem[]> {
    let query = `
      SELECT b.*, u.full_name as author_name, u.email as author_email
      FROM books b
      JOIN users u ON u.id = b.author_id
    `;
    const params: unknown[] = [];

    if (status) {
      query += ` WHERE b.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY b.created_at DESC`;

    const res = await this.db.query<AdminBookListItem>(query, params);
    return res.rows;
  }

  async getBookDetails(id: string): Promise<AdminBookListItem> {
    const res = await this.db.query<AdminBookListItem>(
      `SELECT b.*, u.full_name as author_name, u.email as author_email
       FROM books b
       JOIN users u ON u.id = b.author_id
       WHERE b.id = $1`,
      [id],
    );
    if (res.rowCount === 0) throw new NotFoundException('Book not found.');
    return res.rows[0];
  }

  async approveBook(id: string, req: Request): Promise<BookRow> {
    const existing = await this.db.query<BookRow>('SELECT * FROM books WHERE id = $1', [id]);
    if (existing.rowCount === 0) throw new NotFoundException('Book not found.');

    const book = existing.rows[0];
    if (book.drm_status !== 'processed') {
      throw new BadRequestException('Cannot approve book before DRM processing has completed.');
    }

    const res = await this.db.query<BookRow>(
      `UPDATE books
       SET status = 'live',
           live_at = now(),
           review_notes = NULL
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    await this.audit.record(req, {
      action: 'admin.book_approved',
      entityType: 'book',
      entityId: id,
      metadata: { title: book.title, authorId: book.author_id },
    });

    return res.rows[0];
  }

  async rejectBook(id: string, req: Request, notes: string): Promise<BookRow> {
    const existing = await this.db.query<BookRow>('SELECT * FROM books WHERE id = $1', [id]);
    if (existing.rowCount === 0) throw new NotFoundException('Book not found.');

    const book = existing.rows[0];
    const res = await this.db.query<BookRow>(
      `UPDATE books
       SET status = 'rejected',
           review_notes = $1
       WHERE id = $2
       RETURNING *`,
      [notes, id],
    );

    await this.audit.record(req, {
      action: 'admin.book_rejected',
      entityType: 'book',
      entityId: id,
      metadata: { title: book.title, notes },
    });

    return res.rows[0];
  }

  async delistBook(id: string, req: Request): Promise<BookRow> {
    const existing = await this.db.query<BookRow>('SELECT * FROM books WHERE id = $1', [id]);
    if (existing.rowCount === 0) throw new NotFoundException('Book not found.');

    const book = existing.rows[0];
    const res = await this.db.query<BookRow>(
      `UPDATE books
       SET status = 'delisted',
           delisted_at = now()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    await this.audit.record(req, {
      action: 'admin.book_delisted',
      entityType: 'book',
      entityId: id,
      metadata: { title: book.title },
    });

    return res.rows[0];
  }
}
