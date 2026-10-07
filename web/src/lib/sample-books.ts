/**
 * SAMPLE DATA for the Sprint 0 storefront preview only.
 * Fictional titles and authors. Replaced by GET /api/storefront in Sprint 4.
 */
export type CoverMotif = "sun" | "waves" | "arch" | "rings" | "stripes" | "grid";

export interface SampleBook {
  id: string;
  title: string;
  author: string;
  priceKes: number;
  category: string;
  pinned?: boolean; // superadmin book: always first (§2.4)
  bestseller?: boolean;
  cover: { bg: string; fg: string; accent: string; motif: CoverMotif };
}

export const CATEGORIES = ["All", "Fiction", "Business", "Education", "Poetry", "Faith", "Children"] as const;

export const SAMPLE_BOOKS: SampleBook[] = [
  { id: "b1", title: "Letters from the Rift Valley", author: "Laibu Editions", priceKes: 650, category: "Fiction", pinned: true, bestseller: true, cover: { bg: "#1c1c21", fg: "#ffffff", accent: "#f6b40e", motif: "sun" } },
  { id: "b2", title: "The M-Pesa Founder's Handbook", author: "Laibu Editions", priceKes: 1200, category: "Business", pinned: true, cover: { bg: "#f6b40e", fg: "#1c1c21", accent: "#1c1c21", motif: "grid" } },
  { id: "b3", title: "Salt on the Savannah", author: "Achieng Odera", priceKes: 800, category: "Fiction", bestseller: true, cover: { bg: "#7a2e1d", fg: "#fff4e0", accent: "#f2a65a", motif: "waves" } },
  { id: "b4", title: "Morning Matatu", author: "Kiprono Langat", priceKes: 450, category: "Poetry", bestseller: true, cover: { bg: "#e9e2d0", fg: "#1c1c21", accent: "#c0392b", motif: "stripes" } },
  { id: "b5", title: "Small Sums, Big Dreams", author: "Wanjiru Kamau", priceKes: 950, category: "Business", bestseller: true, cover: { bg: "#0f4c45", fg: "#e9fbf4", accent: "#f6b40e", motif: "rings" } },
  { id: "b6", title: "Hesabu Made Simple: Form 2", author: "Mwalimu Otieno", priceKes: 550, category: "Education", cover: { bg: "#2453a6", fg: "#ffffff", accent: "#ffd166", motif: "grid" } },
  { id: "b7", title: "The Lamp in Lamu", author: "Zawadi Said", priceKes: 700, category: "Fiction", cover: { bg: "#d97a3a", fg: "#fffaf2", accent: "#2a1a10", motif: "arch" } },
  { id: "b8", title: "Psalms for the Long Road", author: "Pst. Daniel Mutua", priceKes: 400, category: "Faith", cover: { bg: "#3d2f5b", fg: "#f5f0ff", accent: "#e9c46a", motif: "sun" } },
  { id: "b9", title: "Nyota and the Moon Goat", author: "Amani Wekesa", priceKes: 350, category: "Children", cover: { bg: "#ffcf56", fg: "#2b2118", accent: "#e4572e", motif: "rings" } },
  { id: "b10", title: "Code Like a Kenyan", author: "Brian Njoroge", priceKes: 1500, category: "Education", cover: { bg: "#111827", fg: "#a7f3d0", accent: "#34d399", motif: "stripes" } },
  { id: "b11", title: "Rain Over Kisumu", author: "Achieng Odera", priceKes: 750, category: "Fiction", cover: { bg: "#5b7c99", fg: "#f4f7fb", accent: "#ffd166", motif: "waves" } },
  { id: "b12", title: "The Chama Way", author: "Wanjiru Kamau", priceKes: 900, category: "Business", cover: { bg: "#f1e9da", fg: "#3a2a1a", accent: "#0f4c45", motif: "arch" } },
];

/** §2.4 ordering: superadmin books first, then the rest. */
export function storefrontOrder(books: SampleBook[]) {
  return [...books].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
}
