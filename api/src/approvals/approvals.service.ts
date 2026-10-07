import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { EmailService } from '../email/email.service.js';
import { ApprovalDetails } from './approvals.types.js';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly email: EmailService,
  ) {}

  generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  async getPublisherFeeRate(publisherId: string): Promise<number> {
    const res = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT book_id) as count FROM sales_ledger WHERE publisher_id = $1`,
      [publisherId],
    );
    const soldTitles = parseInt(res.rows[0]?.count || '0', 10);
    if (soldTitles >= 21) return 10.0;
    if (soldTitles >= 11) return 10.5;
    return 11.0; // Tier 1-10
  }

  calculateSplit(priceKes: number, authorRoyaltyPct: number, feeRate: number) {
    const exFee = Math.round(priceKes * (feeRate / 100) * 100) / 100;
    const exRemainder = Math.round((priceKes - exFee) * 100) / 100;
    const exAuthor = Math.round(exRemainder * (authorRoyaltyPct / 100) * 100) / 100;
    const exPublisher = Math.round((exRemainder - exAuthor) * 100) / 100;

    return { exFee, exRemainder, exAuthor, exPublisher };
  }

  async getApprovalByToken(token: string): Promise<ApprovalDetails> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const res = await this.db.query(
      `SELECT a.*,
              b.id as book_id, b.title as book_title, b.subtitle as book_subtitle,
              b.description as book_description, b.price_kes as book_price_kes,
              u.full_name as publisher_name, u.email as publisher_email
       FROM approvals a
       JOIN books b ON b.id = a.book_id
       LEFT JOIN users u ON u.id = a.publisher_id
       WHERE a.token_hash = $1`,
      [tokenHash],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException('Invalid or expired approval link.');
    }

    const row = res.rows[0];
    const priceKes = parseFloat(row.book_price_kes);
    const royaltyPct = parseFloat(row.proposed_royalty_pct || '0');
    const feeRate = await this.getPublisherFeeRate(row.publisher_id);
    const split = this.calculateSplit(priceKes, royaltyPct, feeRate);

    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    const isExpired = now > expiresAt && row.status === 'pending';
    const effectiveStatus = isExpired ? 'expired' : row.status;

    return {
      id: row.id,
      bookId: row.book_id,
      bookTitle: row.book_title,
      subtitle: row.book_subtitle,
      description: row.book_description,
      publisherName: row.publisher_name || 'Publisher',
      publisherEmail: row.publisher_email || '',
      authorEmail: row.author_email,
      priceKes,
      authorRoyaltyPct: royaltyPct,
      feeRate,
      exFee: split.exFee,
      exRemainder: split.exRemainder,
      exAuthor: split.exAuthor,
      exPublisher: split.exPublisher,
      status: effectiveStatus,
      expiresAt: row.expires_at,
      isSettled: row.status !== 'pending' || isExpired,
      decidedAt: row.decided_at,
    };
  }

  async approveToken(token: string): Promise<ApprovalDetails> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const approval = await this.getApprovalByToken(token);

    if (approval.status === 'approved' || approval.status === 'declined') {
      return approval; // Idempotent settled return
    }

    if (approval.status === 'expired') {
      throw new BadRequestException('This approval request has expired (14-day limit).');
    }

    // 1. Mark approval approved
    await this.db.query(
      `UPDATE approvals
       SET status = 'approved',
           decided_at = now()
       WHERE token_hash = $1`,
      [tokenHash],
    );

    // 2. Advance book to pending_admin
    await this.db.query(
      `UPDATE books
       SET status = 'pending_admin',
           author_royalty_pct = $1
       WHERE id = $2`,
      [approval.authorRoyaltyPct, approval.bookId],
    );

    // 3. Notify publisher
    await this.email.sendApprovalOutcome({
      publisherEmail: approval.publisherEmail,
      publisherName: approval.publisherName,
      bookTitle: approval.bookTitle,
      outcome: 'approved',
      authorEmail: approval.authorEmail,
    });

    return {
      ...approval,
      status: 'approved',
      isSettled: true,
      decidedAt: new Date().toISOString(),
    };
  }

  async declineToken(token: string): Promise<ApprovalDetails> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const approval = await this.getApprovalByToken(token);

    if (approval.status === 'approved' || approval.status === 'declined') {
      return approval;
    }

    if (approval.status === 'expired') {
      throw new BadRequestException('This approval request has expired.');
    }

    // 1. Mark approval declined
    await this.db.query(
      `UPDATE approvals
       SET status = 'declined',
           decided_at = now()
       WHERE token_hash = $1`,
      [tokenHash],
    );

    // 2. Mark book declined_by_author
    await this.db.query(
      `UPDATE books
       SET status = 'declined_by_author'
       WHERE id = $1`,
      [approval.bookId],
    );

    // 3. Notify publisher
    await this.email.sendApprovalOutcome({
      publisherEmail: approval.publisherEmail,
      publisherName: approval.publisherName,
      bookTitle: approval.bookTitle,
      outcome: 'declined',
      authorEmail: approval.authorEmail,
    });

    return {
      ...approval,
      status: 'declined',
      isSettled: true,
      decidedAt: new Date().toISOString(),
    };
  }
}
