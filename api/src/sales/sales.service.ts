import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  AdminLedgerItem,
  AdminLedgerSummary,
  LibraryItem,
  SaleReportItem,
  UserSalesSummary,
} from './sales.types.js';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private readonly db: DatabaseService) {}

  async getUserSales(
    userId: string,
    role: string,
    bookId?: string,
  ): Promise<UserSalesSummary> {
    const isPublisher = role === 'publisher';
    let query = `
      SELECT sl.*, b.title as book_title
      FROM sales_ledger sl
      JOIN books b ON b.id = sl.book_id
      WHERE sl.entry_type = 'sale'
    `;
    const params: unknown[] = [];

    if (isPublisher) {
      params.push(userId);
      query += ` AND sl.publisher_id = $${params.length}`;
    } else {
      params.push(userId);
      query += ` AND sl.author_id = $${params.length}`;
    }

    if (bookId) {
      params.push(bookId);
      query += ` AND sl.book_id = $${params.length}`;
    }

    query += ` ORDER BY sl.created_at DESC`;

    const res = await this.db.query(query, params);

    let totalGross = 0;
    let totalEarned = 0;

    const sales: SaleReportItem[] = res.rows.map((r) => {
      const gross = parseFloat(r.gross);
      const earned = isPublisher
        ? parseFloat(r.publisher_margin)
        : r.is_publisher_sale
        ? parseFloat(r.author_royalty_amount)
        : parseFloat(r.owner_amount);

      totalGross += gross;
      totalEarned += earned;

      let payoutStatus: 'unallocated' | 'allocated' | 'paid' = 'unallocated';
      if (r.paid_at) payoutStatus = 'paid';
      else if (r.payout_cycle_id) payoutStatus = 'allocated';

      return {
        id: r.id.toString(),
        order_id: r.order_id,
        book_id: r.book_id,
        book_title: r.book_title,
        gross: r.gross,
        fee_rate: r.fee_rate,
        fee_amount: r.fee_amount,
        author_royalty_amount: r.author_royalty_amount,
        publisher_margin: r.publisher_margin,
        owner_amount: r.owner_amount,
        earned_amount: earned.toFixed(2),
        payout_status: payoutStatus,
        created_at: r.created_at,
      };
    });

    return {
      total_sales: sales.length,
      total_gross_kes: Math.round(totalGross * 100) / 100,
      total_earned_kes: Math.round(totalEarned * 100) / 100,
      sales,
    };
  }

  async getAdminLedger(bookId?: string, publisherId?: string): Promise<AdminLedgerSummary> {
    let query = `
      SELECT sl.*, b.title as book_title,
             u.full_name as author_name,
             p.full_name as publisher_name
      FROM sales_ledger sl
      JOIN books b ON b.id = sl.book_id
      JOIN users u ON u.id = sl.author_id
      LEFT JOIN users p ON p.id = sl.publisher_id
      WHERE sl.entry_type = 'sale'
    `;
    const params: unknown[] = [];

    if (bookId) {
      params.push(bookId);
      query += ` AND sl.book_id = $${params.length}`;
    }

    if (publisherId) {
      params.push(publisherId);
      query += ` AND sl.publisher_id = $${params.length}`;
    }

    query += ` ORDER BY sl.created_at DESC`;

    const res = await this.db.query(query, params);

    let totalGross = 0;
    let totalFees = 0;
    let totalAuthorRoyalties = 0;
    let totalPublisherMargins = 0;

    const entries: AdminLedgerItem[] = res.rows.map((r) => {
      totalGross += parseFloat(r.gross);
      totalFees += parseFloat(r.fee_amount);
      totalAuthorRoyalties += parseFloat(r.author_royalty_amount) + (r.is_publisher_sale ? 0 : parseFloat(r.owner_amount));
      totalPublisherMargins += parseFloat(r.publisher_margin);

      return {
        id: r.id.toString(),
        order_id: r.order_id,
        book_id: r.book_id,
        book_title: r.book_title,
        author_name: r.author_name,
        publisher_name: r.publisher_name || null,
        is_publisher_sale: r.is_publisher_sale,
        gross: r.gross,
        fee_rate: r.fee_rate,
        fee_amount: r.fee_amount,
        author_royalty_amount: r.author_royalty_amount,
        publisher_margin: r.publisher_margin,
        owner_amount: r.owner_amount,
        paid_at: r.paid_at,
        created_at: r.created_at,
      };
    });

    return {
      total_orders: entries.length,
      total_gross_kes: Math.round(totalGross * 100) / 100,
      total_fees_kes: Math.round(totalFees * 100) / 100,
      total_author_royalties_kes: Math.round(totalAuthorRoyalties * 100) / 100,
      total_publisher_margins_kes: Math.round(totalPublisherMargins * 100) / 100,
      entries,
    };
  }

  async getBuyerLibrary(buyerId: string): Promise<LibraryItem[]> {
    const res = await this.db.query<LibraryItem>(
      `SELECT l.id as licence_id, l.max_devices, l.issued_at,
              b.id as book_id, b.title, b.slug, b.subtitle, b.file_format, b.cover_object_key,
              u.full_name as author_name,
              p.full_name as publisher_name
       FROM licences l
       JOIN books b ON b.id = l.book_id
       JOIN users u ON u.id = b.author_id
       LEFT JOIN users p ON p.id = b.publisher_id
       WHERE l.user_id = $1 AND l.revoked_at IS NULL
       ORDER BY l.issued_at DESC`,
      [buyerId],
    );
    return res.rows;
  }
}
