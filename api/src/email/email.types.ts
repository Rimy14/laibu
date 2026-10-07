export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AuthorApprovalEmailParams {
  toEmail: string;
  authorName: string;
  publisherName: string;
  bookTitle: string;
  priceKes: number;
  authorRoyaltyPct: number;
  feeRate: number;
  exFee: number;
  exRemainder: number;
  exAuthor: number;
  exPublisher: number;
  reviewUrl: string;
  expiresOn: string;
}

export interface ApprovalOutcomeEmailParams {
  publisherEmail: string;
  publisherName: string;
  bookTitle: string;
  outcome: 'approved' | 'declined' | 'rejected';
  authorEmail?: string;
  notes?: string;
}

export interface PayoutDisbursedEmailParams {
  toEmail: string;
  recipientName: string;
  netAmountKes: number;
  paymentReference: string;
  payoutMethodLabel: string;
  paydayFormatted: string;
}

