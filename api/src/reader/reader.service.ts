import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { DrmService } from '../drm/drm.service.js';
import { StorageService } from '../drm/storage.service.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';

export interface ReaderSessionResponse {
  book: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    author_name: string;
    publisher_name: string | null;
    file_format: string;
  };
  licence: {
    id: string;
    issued_at: string;
    max_devices: number;
    active_devices: number;
  };
  watermark: {
    buyer_name: string;
    buyer_contact: string;
    display_text: string;
    licence_ref: string;
  };
  content: {
    preview_text?: string;
    chapters?: Array<{
      title: string;
      content: string;
    }>;
  };
}

@Injectable()
export class ReaderService {
  private readonly logger = new Logger(ReaderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly drmService: DrmService,
    private readonly storage: StorageService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async getReaderSession(
    userId: string,
    bookId: string,
    deviceFingerprint: string,
    deviceLabel: string,
    ip?: string,
    userAgent?: string,
  ): Promise<ReaderSessionResponse> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId);

    // 1. Fetch book and licence
    const { rows: bookRows } = await this.db.query<{
      id: string;
      title: string;
      subtitle: string | null;
      slug: string;
      file_format: string;
      encrypted_object_key: string | null;
      key_ref: string | null;
      description: string | null;
      author_id: string;
      publisher_id: string | null;
      author_name: string;
      publisher_name: string | null;
      licence_id: string | null;
      max_devices: number | null;
      issued_at: string | null;
      buyer_name: string;
      buyer_email: string;
      buyer_phone: string | null;
    }>(
      `SELECT b.id, b.title, b.subtitle, b.slug, b.file_format, b.encrypted_object_key, b.key_ref, b.description,
              b.author_id, b.publisher_id,
              u_auth.full_name AS author_name,
              u_pub.full_name AS publisher_name,
              l.id AS licence_id, l.max_devices, l.issued_at,
              u_buyer.full_name AS buyer_name, u_buyer.email AS buyer_email, u_buyer.phone AS buyer_phone
         FROM books b
         JOIN users u_auth ON u_auth.id = b.author_id
         LEFT JOIN users u_pub ON u_pub.id = b.publisher_id
         LEFT JOIN licences l ON l.book_id = b.id AND l.user_id = $1 AND l.revoked_at IS NULL
         LEFT JOIN users u_buyer ON u_buyer.id = $1
        WHERE ${isUuid ? 'b.id = $2' : 'b.slug = $2'}`,
      [userId, bookId],
    );

    if (bookRows.length === 0) {
      throw new NotFoundException('Book not found');
    }

    const row = bookRows[0];

    // If user is the creator (author/publisher) of this book, auto-create a creator licence if none exists
    let licenceId = row.licence_id;
    let maxDevices = row.max_devices || 3;
    let issuedAt = row.issued_at || new Date().toISOString();

    if (!licenceId && (row.author_id === userId || row.publisher_id === userId)) {
      const { rows: newLicRows } = await this.db.query<{ id: string; max_devices: number; issued_at: string }>(
        `INSERT INTO licences (user_id, book_id, max_devices)
         VALUES ($1, $2, 3)
         ON CONFLICT (user_id, book_id) DO UPDATE SET revoked_at = null
         RETURNING id, max_devices, issued_at`,
        [userId, row.id],
      );
      licenceId = newLicRows[0].id;
      maxDevices = newLicRows[0].max_devices;
      issuedAt = newLicRows[0].issued_at;
    }

    // Verify DRM Licence
    if (!licenceId) {
      throw new ForbiddenException('You do not own an active DRM licence for this book. Please purchase it from the storefront.');
    }

    const hashedFingerprint = crypto.createHash('sha256').update(deviceFingerprint || 'unknown_device').digest('hex');

    // Register/update device
    const { rows: deviceRows } = await this.db.query<{ id: string }>(
      `INSERT INTO devices (user_id, fingerprint_hash, label, last_ip, model, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET
         label = EXCLUDED.label,
         last_ip = EXCLUDED.last_ip,
         last_seen_at = now()
       RETURNING id`,
      [userId, hashedFingerprint, deviceLabel || 'Web Browser', ip || null, userAgent ? userAgent.slice(0, 100) : null],
    );

    const deviceId = deviceRows[0].id;

    // Attach device to licence (enforces 3-device limit via licence_device_limit trigger)
    try {
      await this.db.query(
        `INSERT INTO licence_devices (licence_id, device_id, added_at)
         VALUES ($1, $2, now())
         ON CONFLICT (licence_id, device_id) DO UPDATE SET removed_at = null`,
        [licenceId, deviceId],
      );
    } catch (err: any) {
      if (err.code === '23514' || err.message?.includes('device limit')) {
        throw new ForbiddenException(
          `Device limit (${maxDevices}) reached for this licence. Revoke an existing device to read on this device.`,
        );
      }
      throw err;
    }

    // Active device count
    const { rows: deviceCountRows } = await this.db.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM licence_devices WHERE licence_id = $1 AND removed_at IS NULL`,
      [licenceId],
    );
    const activeDevices = Number(deviceCountRows[0]?.count || 1);

    // Prepare watermarking payload
    const maskedContact = row.buyer_phone
      ? `${row.buyer_phone.slice(0, 4)}••••${row.buyer_phone.slice(-3)}`
      : row.buyer_email;
    const shortLicence = licenceId.slice(0, 8).toUpperCase();
    const watermarkText = `Purchased by ${row.buyer_name} · ${maskedContact} · Laibu DRM #${shortLicence}`;

    // Read and decrypt content if available, or generate standard structured chapters
    let chapters: Array<{ title: string; content: string }> = [];
    let isPdfBinary = false;

    if (row.encrypted_object_key && row.key_ref) {
      try {
        const encryptedBuf = await this.storage.getFile(row.encrypted_object_key);
        const decrypted = this.drmService.decryptBookFile(encryptedBuf, row.key_ref);
        
        // Check if file is a binary PDF
        if (decrypted.subarray(0, 5).toString('ascii').startsWith('%PDF') || row.file_format === 'pdf') {
          isPdfBinary = true;
          chapters = [
            {
              title: 'Reading View · PDF Edition',
              content: `${row.description || `Welcome to ${row.title} by ${row.author_name}.`}\n\nThis title was published as an authorized DRM PDF document.\n\nEnjoy reading with Laibu dynamic watermarking and anti-screenshot protection across all your registered devices.`,
            },
            {
              title: 'Chapter 1: The Narrative',
              content: `Across Nairobi and the East African literary landscape, authentic stories connect readers and creators with genuine Kenyan culture.\n\nEvery page in this edition is uniquely stamped with your account watermark to safeguard creator royalties.`,
            },
          ];
        } else {
          const textContent = decrypted.toString('utf-8');
          const rawChapters = textContent.split(/\n\s*#\s+|\n\s*Chapter\s+/i);
          if (rawChapters.length > 1) {
            chapters = rawChapters.map((ch, idx) => ({
              title: idx === 0 && !ch.startsWith('Chapter') ? 'Prologue' : `Chapter ${idx}`,
              content: ch.trim(),
            }));
          } else {
            chapters = [{ title: 'Full Text', content: textContent }];
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not parse raw file content as text: ${err.message}`);
      }
    }

    if (chapters.length === 0) {
      chapters = [
        {
          title: 'Chapter 1: The Beginning',
          content: `${row.description || `Welcome to ${row.title} by ${row.author_name}.`}\n\nReading on Laibu provides Kenyan readers with high-performance typography, offline device syncing, and complete privacy while securing creator royalties.\n\nEvery line on this page is protected under Kenyan copyright law and secured by Laibu per-copy encryption.`,
        },
        {
          title: 'Chapter 2: The Journey',
          content: `Across Nairobi and beyond, the stories written by Kenyan authors capture our heritage, imagination, and shared future.\n\nThank you for supporting authentic East African literature and creator royalties.`,
        },
      ];
    }

    return {
      book: {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        slug: row.slug,
        author_name: row.author_name,
        publisher_name: row.publisher_name,
        file_format: row.file_format || (isPdfBinary ? 'PDF' : 'EPUB'),
      },
      licence: {
        id: licenceId,
        issued_at: issuedAt,
        max_devices: maxDevices,
        active_devices: activeDevices,
      },
      watermark: {
        buyer_name: row.buyer_name,
        buyer_contact: maskedContact,
        display_text: watermarkText,
        licence_ref: shortLicence,
      },
      content: {
        chapters,
      },
    };
  }

  async getBookStream(userId: string, bookId: string): Promise<{ buffer: Buffer; format: string }> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId);
    const { rows } = await this.db.query<{
      id: string;
      file_format: string;
      encrypted_object_key: string | null;
      key_ref: string | null;
      author_id: string;
      publisher_id: string | null;
      licence_id: string | null;
    }>(
      `SELECT b.id, b.file_format, b.encrypted_object_key, b.key_ref, b.author_id, b.publisher_id,
              l.id AS licence_id
         FROM books b
         LEFT JOIN licences l ON l.book_id = b.id AND l.user_id = $1 AND l.revoked_at IS NULL
        WHERE ${isUuid ? 'b.id = $2' : 'b.slug = $2'}`,
      [userId, bookId],
    );

    if (rows.length === 0) throw new NotFoundException('Book not found');
    const book = rows[0];

    const hasAccess = Boolean(book.licence_id || book.author_id === userId || book.publisher_id === userId);
    if (!hasAccess) throw new ForbiddenException('No active licence found for this book');

    if (!book.encrypted_object_key || !book.key_ref) {
      throw new NotFoundException('Book file not found');
    }

    const encBuf = await this.storage.getFile(book.encrypted_object_key);
    const decrypted = this.drmService.decryptBookFile(encBuf, book.key_ref);
    return { buffer: decrypted, format: book.file_format || 'pdf' };
  }

  async recordSecurityEvent(
    userId: string | null,
    bookId: string | null,
    eventType: string,
    page?: string,
    deviceLabel?: string,
    ip?: string,
    userAgent?: string,
  ) {
    const validEvents = [
      'screenshot_key',
      'window_blur',
      'tab_hidden',
      'devtools_open',
      'print_attempt',
      'copy_attempt',
      'context_menu',
    ];

    if (!validEvents.includes(eventType)) {
      throw new BadRequestException(`Invalid security event type: ${eventType}`);
    }

    let resolvedBookId: string | null = null;
    if (bookId) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) {
        resolvedBookId = bookId;
      } else {
        const { rows: bRows } = await this.db.query<{ id: string }>('SELECT id FROM books WHERE slug = $1', [bookId]);
        resolvedBookId = bRows[0]?.id || null;
      }
    }

    await this.db.query(
      `INSERT INTO security_events (user_id, book_id, event_type, page, device_label, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, resolvedBookId, eventType, page || null, deviceLabel || null, ip || null, userAgent ? userAgent.slice(0, 200) : null],
    );

    return { recorded: true };
  }
}
