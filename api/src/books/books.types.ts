import { z } from 'zod';

export const BOOK_FORMATS = ['pdf', 'epub', 'docx', 'html'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const BOOK_STATUSES = [
  'draft',
  'pending_author',
  'declined_by_author',
  'pending_admin',
  'rejected',
  'live',
  'delisted',
] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const DRM_STATUSES = ['pending', 'processing', 'processed', 'failed'] as const;
export type DrmStatus = (typeof DRM_STATUSES)[number];

export interface UploadedFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().min(2).max(10).default('en'),
  category: z.string().max(50).optional(),
  page_count: z.coerce.number().int().positive().optional(),
  price_kes: z.coerce.number().min(0, 'Price must be non-negative'),
});

export type CreateBookDto = z.infer<typeof createBookSchema>;

export const adminRejectSchema = z.object({
  notes: z.string().min(3).max(1000),
});

export type AdminRejectDto = z.infer<typeof adminRejectSchema>;

export interface BookRow {
  id: string;
  author_id: string;
  publisher_id: string | null;
  created_by: string;
  is_superadmin_book: boolean;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  category: string | null;
  page_count: number | null;
  price_kes: string;
  author_royalty_pct: string | null;
  status: BookStatus;
  drm_status: DrmStatus;
  file_format: BookFormat | null;
  file_size_bytes: string | null;
  file_sha256: string | null;
  raw_object_key: string | null;
  encrypted_object_key: string | null;
  key_ref: string | null;
  cover_object_key: string | null;
  virus_scanned_at: Date | null;
  review_notes: string | null;
  live_at: Date | null;
  delisted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
