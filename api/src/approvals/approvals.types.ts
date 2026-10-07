import { z } from 'zod';

export interface ApprovalDetails {
  id: string;
  bookId: string;
  bookTitle: string;
  subtitle: string | null;
  description: string | null;
  publisherName: string;
  publisherEmail: string;
  authorEmail: string;
  priceKes: number;
  authorRoyaltyPct: number;
  feeRate: number;
  exFee: number;
  exRemainder: number;
  exAuthor: number;
  exPublisher: number;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  expiresAt: string;
  isSettled: boolean;
  decidedAt: string | null;
}

export const createPublisherBookSchema = z.object({
  title: z.string().min(1).max(200),
  author_email: z.string().email(),
  author_royalty_pct: z.coerce.number().min(1).max(99),
  price_kes: z.coerce.number().min(0),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().min(2).max(10).default('en'),
  category: z.string().max(50).optional(),
  page_count: z.coerce.number().int().positive().optional(),
});

export type CreatePublisherBookDto = z.infer<typeof createPublisherBookSchema>;

export const requestSellExistingSchema = z.object({
  author_royalty_pct: z.coerce.number().min(1).max(99),
});

export type RequestSellExistingDto = z.infer<typeof requestSellExistingSchema>;
