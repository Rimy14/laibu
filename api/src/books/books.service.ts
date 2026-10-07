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
import { BookFormat, BookRow, CreateBookDto, UploadedFile } from './books.types.js';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly scanner: VirusScannerService,
    private readonly drm: DrmService,
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

  async createAuthorBook(
    authorId: string,
    dto: CreateBookDto,
    file?: UploadedFile,
    cover?: UploadedFile,
  ): Promise<BookRow> {
    if (!file) {
      throw new BadRequestException('Book file is required.');
    }

    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Book file size exceeds maximum 50MB limit.');
    }

    if (cover && cover.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Cover image size exceeds maximum 5MB limit.');
    }

    // 1. Detect format
    const format = this.detectFormat(file.mimetype, file.originalname);

    // 2. Virus scan
    const scan = await this.scanner.scanBuffer(file.buffer);
    if (scan.isInfected) {
      throw new UnprocessableEntityException(`Malware detected: ${scan.virusName || 'Infected file'}`);
    }

    // 3. Save raw file & cover
    const rawKey = await this.storage.saveRaw(file.originalname, file.buffer);
    let coverKey: string | null = null;
    if (cover) {
      coverKey = await this.storage.saveCover(cover.originalname, cover.buffer);
    }

    // 4. Generate unique slug
    const slug = await this.generateUniqueSlug(dto.title);

    // 5. Insert draft / pending_admin record
    const insertRes = await this.db.query<BookRow>(
      `INSERT INTO books (
        author_id, created_by, is_superadmin_book, title, slug, subtitle,
        description, language, category, page_count, price_kes, status,
        drm_status, file_format, file_size_bytes, raw_object_key, cover_object_key,
        virus_scanned_at
      ) VALUES (
        $1, $1, false, $2, $3, $4,
        $5, $6, $7, $8, $9, 'pending_admin',
        'processing', $10, $11, $12, $13,
        now()
      ) RETURNING *`,
      [
        authorId,
        dto.title,
        slug,
        dto.subtitle || null,
        dto.description || null,
        dto.language || 'en',
        dto.category || null,
        dto.page_count || null,
        dto.price_kes,
        format,
        file.size,
        rawKey,
        coverKey,
      ],
    );

    const book = insertRes.rows[0];

    // 6. Process DRM (encrypt AES-256-GCM, delete raw)
    try {
      const drmResult = await this.drm.processBookDrm(rawKey, file.originalname);
      const updateRes = await this.db.query<BookRow>(
        `UPDATE books
         SET drm_status = 'processed',
             encrypted_object_key = $1,
             key_ref = $2,
             file_sha256 = $3,
             file_size_bytes = $4,
             raw_object_key = NULL
         WHERE id = $5
         RETURNING *`,
        [drmResult.encryptedObjectKey, drmResult.keyRef, drmResult.sha256, drmResult.sizeBytes, book.id],
      );
      return updateRes.rows[0];
    } catch (err) {
      this.logger.error(`DRM encryption failed for book ${book.id}`, err);
      await this.db.query(`UPDATE books SET drm_status = 'failed' WHERE id = $1`, [book.id]);
      throw new UnprocessableEntityException('Failed to process book DRM encryption.');
    }
  }

  async getAuthorBooks(authorId: string): Promise<BookRow[]> {
    const res = await this.db.query<BookRow>(
      `SELECT * FROM books WHERE author_id = $1 ORDER BY created_at DESC`,
      [authorId],
    );
    return res.rows;
  }

  async getBookById(id: string, userId?: string, userRole?: string): Promise<BookRow> {
    const res = await this.db.query<BookRow>(`SELECT * FROM books WHERE id = $1`, [id]);
    if (res.rowCount === 0) throw new NotFoundException('Book not found.');

    const book = res.rows[0];
    if (
      book.status === 'live' ||
      userRole === 'superadmin' ||
      (userId && (book.author_id === userId || book.publisher_id === userId))
    ) {
      return book;
    }

    throw new NotFoundException('Book not found or not published.');
  }

  async getBookBySlug(slug: string): Promise<BookRow> {
    const res = await this.db.query<BookRow>(`SELECT * FROM books WHERE slug = $1 AND status = 'live'`, [slug]);
    if (res.rowCount === 0) throw new NotFoundException('Book not found.');
    return res.rows[0];
  }
}
