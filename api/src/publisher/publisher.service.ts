import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StorageService } from '../drm/storage.service.js';
import { VirusScannerService } from '../drm/virus-scanner.service.js';
import { DrmService } from '../drm/drm.service.js';
import { EmailService } from '../email/email.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { CreatePublisherBookDto, RequestSellExistingDto } from '../approvals/approvals.types.js';
import { BookFormat, BookRow, UploadedFile } from '../books/books.types.js';

@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly scanner: VirusScannerService,
    private readonly drm: DrmService,
    private readonly email: EmailService,
    private readonly approvals: ApprovalsService,
  ) {}

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title) || 'untitled-book';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const res = await this.db.query('SELECT 1 FROM books WHERE slug = $1', [slug]);
      if (res.rowCount === 0) return slug;
      slug = `${baseSlug}-${counter++}`;
    }
  }

  private detectFormat(mimetype: string, originalname: string): BookFormat {
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (mimetype === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mimetype === 'application/epub+zip' || ext === 'epub') return 'epub';
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    )
      return 'docx';
    if (mimetype === 'text/html' || ext === 'html') return 'html';

    throw new BadRequestException('Unsupported file format. Supported formats: PDF, EPUB, DOCX, HTML.');
  }

  private async findOrCreateAuthor(email: string): Promise<{ id: string; fullName: string }> {
    const res = await this.db.query<{ id: string; full_name: string }>(
      'SELECT id, full_name FROM users WHERE lower(email) = lower($1)',
      [email],
    );

    if (res.rowCount && res.rows[0]) {
      return { id: res.rows[0].id, fullName: res.rows[0].full_name };
    }

    // Create placeholder author user
    const name = email.split('@')[0] || 'Author';
    const insertRes = await this.db.query<{ id: string; full_name: string }>(
      `INSERT INTO users (role, full_name, email, password_hash)
       VALUES ('author', $1, $2, 'placeholder')
       RETURNING id, full_name`,
      [name, email.toLowerCase()],
    );

    return { id: insertRes.rows[0].id, fullName: insertRes.rows[0].full_name };
  }

  async createPublisherBook(
    publisherId: string,
    dto: CreatePublisherBookDto,
    file?: UploadedFile,
    cover?: UploadedFile,
  ): Promise<BookRow> {
    if (!file) throw new BadRequestException('Book file is required.');

    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Book file exceeds 50MB limit.');
    }

    // 1. Get publisher info
    const pubRes = await this.db.query<{ full_name: string; email: string }>(
      'SELECT full_name, email FROM users WHERE id = $1',
      [publisherId],
    );
    const publisherName = pubRes.rows[0]?.full_name || 'Publisher';

    // 2. Format & virus scan
    const format = this.detectFormat(file.mimetype, file.originalname);
    const scan = await this.scanner.scanBuffer(file.buffer);
    if (scan.isInfected) {
      throw new UnprocessableEntityException('Malware detected in uploaded file.');
    }

    // 3. Save raw file & cover
    const rawKey = await this.storage.saveRaw(file.originalname, file.buffer);
    let coverKey: string | null = null;
    if (cover) coverKey = await this.storage.saveCover(cover.originalname, cover.buffer);

    // 4. Find or create Author
    const author = await this.findOrCreateAuthor(dto.author_email);
    const slug = await this.generateUniqueSlug(dto.title);

    // 5. Insert book in pending_author status
    const insertBook = await this.db.query<BookRow>(
      `INSERT INTO books (
        author_id, publisher_id, created_by, is_superadmin_book, title, slug,
        subtitle, description, language, category, page_count, price_kes,
        author_royalty_pct, status, drm_status, file_format, file_size_bytes,
        raw_object_key, cover_object_key, virus_scanned_at
      ) VALUES (
        $1, $2, $2, false, $3, $4,
        $5, $6, $7, $8, $9, $10,
        $11, 'pending_author', 'processing', $12, $13,
        $14, $15, now()
      ) RETURNING *`,
      [
        author.id,
        publisherId,
        dto.title,
        slug,
        dto.subtitle || null,
        dto.description || null,
        dto.language || 'en',
        dto.category || null,
        dto.page_count || null,
        dto.price_kes,
        dto.author_royalty_pct,
        format,
        file.size,
        rawKey,
        coverKey,
      ],
    );

    const book = insertBook.rows[0];

    // 6. Process DRM
    const drmResult = await this.drm.processBookDrm(rawKey, file.originalname);
    await this.db.query(
      `UPDATE books
       SET drm_status = 'processed',
           encrypted_object_key = $1,
           key_ref = $2,
           file_sha256 = $3,
           file_size_bytes = $4,
           raw_object_key = NULL
       WHERE id = $5`,
      [drmResult.encryptedObjectKey, drmResult.keyRef, drmResult.sha256, drmResult.sizeBytes, book.id],
    );

    // 7. Generate Token & Approval entry
    const { rawToken, tokenHash } = this.approvals.generateToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO approvals (
        book_id, kind, stage, status, publisher_id, author_email,
        proposed_royalty_pct, token_hash, expires_at
      ) VALUES (
        $1, 'new_book', 'author', 'pending', $2, $3,
        $4, $5, $6
      )`,
      [book.id, publisherId, dto.author_email, dto.author_royalty_pct, tokenHash, expiresAt],
    );

    // 8. Compute split & send email
    const feeRate = await this.approvals.getPublisherFeeRate(publisherId);
    const split = this.approvals.calculateSplit(dto.price_kes, dto.author_royalty_pct, feeRate);
    const reviewUrl = `http://localhost:3000/approve/${rawToken}`;

    await this.email.sendAuthorApprovalRequest({
      toEmail: dto.author_email,
      authorName: author.fullName,
      publisherName,
      bookTitle: dto.title,
      priceKes: dto.price_kes,
      authorRoyaltyPct: dto.author_royalty_pct,
      feeRate,
      exFee: split.exFee,
      exRemainder: split.exRemainder,
      exAuthor: split.exAuthor,
      exPublisher: split.exPublisher,
      reviewUrl,
      expiresOn: expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });

    return book;
  }

  async requestSellExisting(
    publisherId: string,
    bookId: string,
    dto: RequestSellExistingDto,
  ): Promise<{ message: string }> {
    const bookRes = await this.db.query<BookRow>(
      `SELECT b.*, u.email as author_email, u.full_name as author_name
       FROM books b
       JOIN users u ON u.id = b.author_id
       WHERE b.id = $1`,
      [bookId],
    );

    if (bookRes.rowCount === 0) throw new NotFoundException('Book not found.');
    const book = bookRes.rows[0];

    if (book.status !== 'live') {
      throw new BadRequestException('Can only request to sell live books.');
    }

    const pubRes = await this.db.query<{ full_name: string }>(
      'SELECT full_name FROM users WHERE id = $1',
      [publisherId],
    );
    const publisherName = pubRes.rows[0]?.full_name || 'Publisher';

    const { rawToken, tokenHash } = this.approvals.generateToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO approvals (
        book_id, kind, stage, status, publisher_id, author_email,
        proposed_royalty_pct, token_hash, expires_at
      ) VALUES (
        $1, 'sell_request', 'author', 'pending', $2, $3,
        $4, $5, $6
      )`,
      [book.id, publisherId, (book as any).author_email, dto.author_royalty_pct, tokenHash, expiresAt],
    );

    const priceKes = parseFloat(book.price_kes);
    const feeRate = await this.approvals.getPublisherFeeRate(publisherId);
    const split = this.approvals.calculateSplit(priceKes, dto.author_royalty_pct, feeRate);
    const reviewUrl = `http://localhost:3000/approve/${rawToken}`;

    await this.email.sendAuthorApprovalRequest({
      toEmail: (book as any).author_email,
      authorName: (book as any).author_name,
      publisherName,
      bookTitle: book.title,
      priceKes,
      authorRoyaltyPct: dto.author_royalty_pct,
      feeRate,
      exFee: split.exFee,
      exRemainder: split.exRemainder,
      exAuthor: split.exAuthor,
      exPublisher: split.exPublisher,
      reviewUrl,
      expiresOn: expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });

    return { message: 'Approval request sent to the author.' };
  }

  async getPublisherBooks(publisherId: string): Promise<BookRow[]> {
    const res = await this.db.query<BookRow>(
      `SELECT * FROM books WHERE publisher_id = $1 ORDER BY created_at DESC`,
      [publisherId],
    );
    return res.rows;
  }
}
