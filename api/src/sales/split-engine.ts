export interface SplitInput {
  gross: number;
  isPublisherSale: boolean;
  publisherSoldTitles?: number;
  authorRoyaltyPct?: number;
}

export interface SplitResult {
  gross: number;
  feeRate: number;
  feeAmount: number;
  authorRoyaltyPct: number;
  authorRoyaltyAmount: number;
  publisherMargin: number;
  ownerAmount: number;
}

/**
 * Canonical Split Engine (§2.1, §2.2, §7)
 * - Evaluated at the moment of sale and frozen on the ledger line.
 * - Fee is charged on gross. Author royalty is taken from the post-fee remainder.
 * - Exact 2 decimal places rounding with zero drift:
 *   feeAmount + authorRoyaltyAmount + publisherMargin + ownerAmount === gross
 */
export function calculateSaleSplit(input: SplitInput): SplitResult {
  const gross = Math.round(input.gross * 100) / 100;

  if (!input.isPublisherSale) {
    // Direct sale (no publisher): 12.5% fee (§2.1)
    const feeRate = 12.5;
    const feeAmount = Math.round(gross * 0.125 * 100) / 100;
    const ownerAmount = Math.round((gross - feeAmount) * 100) / 100;

    return {
      gross,
      feeRate,
      feeAmount,
      authorRoyaltyPct: 0,
      authorRoyaltyAmount: 0,
      publisherMargin: 0,
      ownerAmount,
    };
  }

  // Publisher sale: Tiered fee based on distinct sold titles (§2.1)
  const soldTitles = input.publisherSoldTitles ?? 0;
  const feeRate = soldTitles >= 21 ? 10.0 : soldTitles >= 11 ? 10.5 : 11.0;

  const feeAmount = Math.round(gross * (feeRate / 100) * 100) / 100;
  const remainder = Math.round((gross - feeAmount) * 100) / 100;

  const authorRoyaltyPct = input.authorRoyaltyPct ?? 0;
  const authorRoyaltyAmount = Math.round(remainder * (authorRoyaltyPct / 100) * 100) / 100;
  const publisherMargin = Math.round((remainder - authorRoyaltyAmount) * 100) / 100;

  return {
    gross,
    feeRate,
    feeAmount,
    authorRoyaltyPct,
    authorRoyaltyAmount,
    publisherMargin,
    ownerAmount: 0,
  };
}
