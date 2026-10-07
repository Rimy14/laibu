export interface SaleReportItem {
  id: string;
  order_id: string;
  book_id: string;
  book_title: string;
  gross: string;
  fee_rate: string;
  fee_amount: string;
  author_royalty_amount: string;
  publisher_margin: string;
  owner_amount: string;
  earned_amount: string;
  payout_status: 'unallocated' | 'allocated' | 'paid';
  created_at: string;
}

export interface UserSalesSummary {
  total_sales: number;
  total_gross_kes: number;
  total_earned_kes: number;
  sales: SaleReportItem[];
}

export interface LibraryItem {
  licence_id: string;
  book_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  author_name: string;
  publisher_name: string | null;
  file_format: string | null;
  cover_object_key: string | null;
  max_devices: number;
  issued_at: string;
}

export interface AdminLedgerItem {
  id: string;
  order_id: string;
  book_id: string;
  book_title: string;
  author_name: string;
  publisher_name: string | null;
  is_publisher_sale: boolean;
  gross: string;
  fee_rate: string;
  fee_amount: string;
  author_royalty_amount: string;
  publisher_margin: string;
  owner_amount: string;
  paid_at: string | null;
  created_at: string;
}

export interface AdminLedgerSummary {
  total_orders: number;
  total_gross_kes: number;
  total_fees_kes: number;
  total_author_royalties_kes: number;
  total_publisher_margins_kes: number;
  entries: AdminLedgerItem[];
}
